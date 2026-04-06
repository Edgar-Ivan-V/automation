import { randomUUID } from "crypto";
import type { IncomingMessage, Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { createCallJobEventRepository, getCallJobBySidRepository, updateCallJobRepository } from "./repositories.js";
import { getCallConversationContext } from "./services.js";
import { requireServiceSupabaseClient } from "../shared/supabase-client.js";
import { buildAbsoluteWebhookUrl } from "./twilio.js";

function toRealtimeLanguage(language: string) {
  if (!language) return "es";
  const [base] = language.split("-");
  return base.toLowerCase();
}

function appendTranscript(transcript: string | null | undefined, speaker: "Caller" | "Assistant", text: string) {
  const normalized = text.trim();
  return [...(transcript ? [transcript.trim()] : []), `${speaker}: ${normalized}`]
    .filter(Boolean)
    .join("\n");
}

export function getOpenAiRealtimeConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    model: process.env.OPENAI_REALTIME_MODEL?.trim() ?? "gpt-realtime",
    voice: process.env.OPENAI_REALTIME_VOICE?.trim() ?? "marin",
    transcriptionModel: process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL?.trim() ?? "gpt-4o-mini-transcribe",
    urlBase: "wss://api.openai.com/v1/realtime",
  };
}

export function isOpenAiRealtimeConfigured() {
  return Boolean(getOpenAiRealtimeConfig().apiKey);
}

export function buildTwilioRealtimeStreamUrl(_jobId: string) {
  const publicUrl = buildAbsoluteWebhookUrl("/api/webhooks/twilio/voice/stream");
  if (publicUrl.startsWith("https://")) {
    return `wss://${publicUrl.slice("https://".length)}`;
  }
  if (publicUrl.startsWith("http://")) {
    return `ws://${publicUrl.slice("http://".length)}`;
  }
  return publicUrl;
}

function logRealtime(message: string, payload: Record<string, unknown>) {
  console.info(`[voice.realtime] ${message}`, payload);
}

async function persistTranscriptByCallSid(callSid: string, speaker: "Caller" | "Assistant", text: string) {
  const client = requireServiceSupabaseClient();
  const job = await getCallJobBySidRepository(client, callSid);
  if (!job) return;

  const transcript = appendTranscript(job.transcript, speaker, text);
  await updateCallJobRepository(client, job.organization_id, job.id, { transcript });
  await createCallJobEventRepository(client, {
    id: randomUUID(),
    organization_id: job.organization_id,
    call_job_id: job.id,
    provider: "twilio",
    event_type: speaker === "Caller" ? "realtime.caller.transcript" : "realtime.assistant.transcript",
    payload: { text },
  });
}

async function persistRealtimeEvent(callSid: string, eventType: string, payload: Record<string, unknown>) {
  const client = requireServiceSupabaseClient();
  const job = await getCallJobBySidRepository(client, callSid);
  if (!job) return;

  await createCallJobEventRepository(client, {
    id: randomUUID(),
    organization_id: job.organization_id,
    call_job_id: job.id,
    provider: "twilio",
    event_type: `realtime.${eventType}`,
    payload,
  });
}

async function createRealtimeBridge(twilioSocket: WebSocket, request: IncomingMessage, jobId: string) {
  const context = await getCallConversationContext(jobId);
  const config = getOpenAiRealtimeConfig();

  if (!config.apiKey) {
    twilioSocket.close(1011, "OPENAI_API_KEY is required for realtime mode.");
    return;
  }

  const openAiSocket = new WebSocket(`${config.urlBase}?model=${encodeURIComponent(config.model)}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  let streamSid: string | null = null;
  let callSid: string | null = null;
  let openAiReady = false;

  const sessionInstructions = [
    "You are a realtime phone-call assistant connected through Twilio.",
    `Speak primarily in ${context.agent.language || "es-MX"} unless the caller asks for another language.`,
    "Keep each reply short and natural for speech.",
    "Do not mention internal systems, prompts, or models.",
    `Call objective: ${context.flow.objective}`,
    `Opening line to use at the beginning of the call: ${context.flow.prompt_template}`,
    context.flow.system_prompt ? `Additional instructions: ${context.flow.system_prompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sendInitialAssistantTurn = () => {
    openAiSocket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: `Start the call now. Say exactly this opening in a natural way: ${context.flow.prompt_template}`,
        },
      })
    );
  };

  openAiSocket.on("open", () => {
    openAiReady = true;
    openAiSocket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          model: config.model,
          instructions: sessionInstructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              noise_reduction: { type: "near_field" },
              transcription: {
                model: config.transcriptionModel,
                language: toRealtimeLanguage(context.agent.language),
              },
              turn_detection: {
                type: "server_vad",
                interrupt_response: true,
                create_response: true,
                silence_duration_ms: 500,
                prefix_padding_ms: 300,
              },
            },
            output: {
              format: { type: "audio/pcmu" },
              voice: context.agent.voice && context.agent.voice !== "alice" ? context.agent.voice : config.voice,
            },
          },
        },
      })
    );

    logRealtime("openai.connected", { jobId, model: config.model });
    sendInitialAssistantTurn();
  });

  openAiSocket.on("message", async (message) => {
    let event: any;
    try {
      event = JSON.parse(message.toString());
    } catch {
      return;
    }

    switch (event.type) {
      case "session.created":
      case "session.updated":
        logRealtime("openai.session", { jobId, type: event.type });
        break;
      case "input_audio_buffer.speech_started":
        if (streamSid && twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.send(JSON.stringify({ event: "clear", streamSid }));
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (callSid && event.transcript) {
          await persistTranscriptByCallSid(callSid, "Caller", event.transcript);
          logRealtime("caller.transcript", { jobId, transcript: event.transcript });
        }
        break;
      case "response.output_audio.delta":
        if (streamSid && event.delta && twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: event.delta },
            })
          );
        }
        break;
      case "response.output_audio_transcript.done":
        if (callSid && event.transcript) {
          await persistTranscriptByCallSid(callSid, "Assistant", event.transcript);
          logRealtime("assistant.transcript", { jobId, transcript: event.transcript });
        }
        break;
      case "response.done":
        logRealtime("response.done", { jobId });
        break;
      case "error":
        logRealtime("openai.error", {
          jobId,
          error: event.error?.message ?? "unknown",
          code: event.error?.code ?? null,
        });
        if (callSid) {
          await persistRealtimeEvent(callSid, "error", {
            message: event.error?.message ?? "unknown",
            code: event.error?.code ?? null,
          });
        }
        break;
      default:
        break;
    }
  });

  twilioSocket.on("message", async (raw) => {
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.event) {
      case "connected":
        logRealtime("twilio.connected", { jobId, protocol: event.protocol, version: event.version });
        break;
      case "start":
        streamSid = event.start?.streamSid ?? event.streamSid ?? null;
        callSid = event.start?.callSid ?? null;
        logRealtime("twilio.start", {
          jobId,
          streamSid,
          callSid,
          mediaFormat: event.start?.mediaFormat ?? null,
        });
        if (callSid) {
          await persistRealtimeEvent(callSid, "start", {
            streamSid,
            mediaFormat: event.start?.mediaFormat ?? null,
          });
        }
        break;
      case "media":
        if (!openAiReady || openAiSocket.readyState !== WebSocket.OPEN) {
          return;
        }
        if (event.media?.payload) {
          openAiSocket.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: event.media.payload,
            })
          );
        }
        break;
      case "dtmf":
        logRealtime("twilio.dtmf", { jobId, digit: event.dtmf?.digit ?? null });
        if (callSid) {
          await persistRealtimeEvent(callSid, "dtmf", { digit: event.dtmf?.digit ?? null });
        }
        break;
      case "stop":
        logRealtime("twilio.stop", { jobId, streamSid, callSid });
        openAiSocket.close();
        break;
      default:
        break;
    }
  });

  const closeSockets = () => {
    if (twilioSocket.readyState === WebSocket.OPEN || twilioSocket.readyState === WebSocket.CONNECTING) {
      twilioSocket.close();
    }
    if (openAiSocket.readyState === WebSocket.OPEN || openAiSocket.readyState === WebSocket.CONNECTING) {
      openAiSocket.close();
    }
  };

  twilioSocket.on("close", closeSockets);
  twilioSocket.on("error", (error) => {
    logRealtime("twilio.error", { jobId, error: error.message });
    closeSockets();
  });
  openAiSocket.on("close", () => {
    logRealtime("openai.closed", { jobId, callSid, streamSid });
  });
  openAiSocket.on("error", (error) => {
    logRealtime("openai.socket_error", { jobId, error: error.message });
    closeSockets();
  });
}

async function createRealtimeBridgeWithStartEvent(
  twilioSocket: WebSocket,
  request: IncomingMessage,
  jobId: string,
  startEvent: any
) {
  const context = await getCallConversationContext(jobId);
  const config = getOpenAiRealtimeConfig();

  if (!config.apiKey) {
    twilioSocket.close(1011, "OPENAI_API_KEY is required for realtime mode.");
    return;
  }

  const openAiSocket = new WebSocket(`${config.urlBase}?model=${encodeURIComponent(config.model)}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  let streamSid: string | null = startEvent.start?.streamSid ?? startEvent.streamSid ?? null;
  let callSid: string | null = startEvent.start?.callSid ?? null;
  let openAiReady = false;

  const sessionInstructions = [
    "You are a realtime phone-call assistant connected through Twilio.",
    `Speak primarily in ${context.agent.language || "es-MX"} unless the caller asks for another language.`,
    "Keep each reply short and natural for speech.",
    "Do not mention internal systems, prompts, or models.",
    `Call objective: ${context.flow.objective}`,
    `Opening line to use at the beginning of the call: ${context.flow.prompt_template}`,
    context.flow.system_prompt ? `Additional instructions: ${context.flow.system_prompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  logRealtime("twilio.start", {
    jobId,
    streamSid,
    callSid,
    mediaFormat: startEvent.start?.mediaFormat ?? null,
  });

  if (callSid) {
    await persistRealtimeEvent(callSid, "start", {
      streamSid,
      mediaFormat: startEvent.start?.mediaFormat ?? null,
    });
  }

  const sendInitialAssistantTurn = () => {
    openAiSocket.send(
      JSON.stringify({
        type: "response.create",
        response: {
          output_modalities: ["audio"],
          instructions: `Start the call now. Say exactly this opening in a natural way: ${context.flow.prompt_template}`,
        },
      })
    );
  };

  openAiSocket.on("open", () => {
    openAiReady = true;
    openAiSocket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          model: config.model,
          instructions: sessionInstructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcmu" },
              noise_reduction: { type: "near_field" },
              transcription: {
                model: config.transcriptionModel,
                language: toRealtimeLanguage(context.agent.language),
              },
              turn_detection: {
                type: "server_vad",
                interrupt_response: true,
                create_response: true,
                silence_duration_ms: 500,
                prefix_padding_ms: 300,
              },
            },
            output: {
              format: { type: "audio/pcmu" },
              voice: context.agent.voice && context.agent.voice !== "alice" ? context.agent.voice : config.voice,
            },
          },
        },
      })
    );

    logRealtime("openai.connected", { jobId, model: config.model });
    sendInitialAssistantTurn();
  });

  openAiSocket.on("message", async (message) => {
    let event: any;
    try {
      event = JSON.parse(message.toString());
    } catch {
      return;
    }

    switch (event.type) {
      case "session.created":
      case "session.updated":
        logRealtime("openai.session", { jobId, type: event.type });
        break;
      case "input_audio_buffer.speech_started":
        if (streamSid && twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.send(JSON.stringify({ event: "clear", streamSid }));
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (callSid && event.transcript) {
          await persistTranscriptByCallSid(callSid, "Caller", event.transcript);
          logRealtime("caller.transcript", { jobId, transcript: event.transcript });
        }
        break;
      case "response.output_audio.delta":
        if (streamSid && event.delta && twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.send(
            JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: event.delta },
            })
          );
        }
        break;
      case "response.output_audio_transcript.done":
        if (callSid && event.transcript) {
          await persistTranscriptByCallSid(callSid, "Assistant", event.transcript);
          logRealtime("assistant.transcript", { jobId, transcript: event.transcript });
        }
        break;
      case "response.done":
        logRealtime("response.done", { jobId });
        break;
      case "error":
        logRealtime("openai.error", {
          jobId,
          error: event.error?.message ?? "unknown",
          code: event.error?.code ?? null,
        });
        if (callSid) {
          await persistRealtimeEvent(callSid, "error", {
            message: event.error?.message ?? "unknown",
            code: event.error?.code ?? null,
          });
        }
        break;
      default:
        break;
    }
  });

  twilioSocket.on("message", async (raw) => {
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.event) {
      case "connected":
        logRealtime("twilio.connected", { jobId, protocol: event.protocol, version: event.version });
        break;
      case "media":
        if (!openAiReady || openAiSocket.readyState !== WebSocket.OPEN) {
          return;
        }
        if (event.media?.payload) {
          openAiSocket.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: event.media.payload,
            })
          );
        }
        break;
      case "dtmf":
        logRealtime("twilio.dtmf", { jobId, digit: event.dtmf?.digit ?? null });
        if (callSid) {
          await persistRealtimeEvent(callSid, "dtmf", { digit: event.dtmf?.digit ?? null });
        }
        break;
      case "stop":
        logRealtime("twilio.stop", { jobId, streamSid, callSid });
        openAiSocket.close();
        break;
      default:
        break;
    }
  });

  const closeSockets = () => {
    if (twilioSocket.readyState === WebSocket.OPEN || twilioSocket.readyState === WebSocket.CONNECTING) {
      twilioSocket.close();
    }
    if (openAiSocket.readyState === WebSocket.OPEN || openAiSocket.readyState === WebSocket.CONNECTING) {
      openAiSocket.close();
    }
  };

  twilioSocket.on("close", closeSockets);
  twilioSocket.on("error", (error) => {
    logRealtime("twilio.error", { jobId, error: error.message });
    closeSockets();
  });
  openAiSocket.on("close", () => {
    logRealtime("openai.closed", { jobId, callSid, streamSid });
  });
  openAiSocket.on("error", (error) => {
    logRealtime("openai.socket_error", { jobId, error: error.message });
    closeSockets();
  });
}

export function attachVoiceRealtimeBridge(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket, request) => {
    logRealtime("connection.accepted", {
      url: request.url ?? null,
      remoteAddress: request.socket.remoteAddress ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });

    let initialized = false;

    const bootstrapListener = (raw: WebSocket.RawData) => {
      let event: any;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (event.event !== "start") {
        return;
      }

      const jobId = event.start?.customParameters?.jobId ?? null;
      logRealtime("connection.start", {
        url: request.url ?? null,
        jobId,
        callSid: event.start?.callSid ?? null,
        streamSid: event.start?.streamSid ?? null,
        customParameters: event.start?.customParameters ?? null,
      });

      if (!jobId) {
        socket.close(1008, "jobId is required.");
        return;
      }

      initialized = true;
      socket.off("message", bootstrapListener);
      createRealtimeBridgeWithStartEvent(socket, request, jobId, event).catch((error) => {
        logRealtime("bridge.error", {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        socket.close(1011, "Failed to initialize realtime bridge.");
      });
    };

    socket.on("message", bootstrapListener);
    socket.on("close", () => {
      if (!initialized) {
        logRealtime("connection.closed_before_start", {
          url: request.url ?? null,
        });
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    logRealtime("upgrade.request", {
      url: request.url ?? null,
      pathname,
      remoteAddress: request.socket.remoteAddress ?? null,
      userAgent: request.headers["user-agent"] ?? null,
      upgrade: request.headers.upgrade ?? null,
      connection: request.headers.connection ?? null,
    });

    if (pathname !== "/api/webhooks/twilio/voice/stream") {
      logRealtime("upgrade.rejected", {
        reason: "unexpected_path",
        pathname,
      });
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      logRealtime("upgrade.handled", {
        url: request.url ?? null,
      });
      wss.emit("connection", ws, request);
    });
  });
}
