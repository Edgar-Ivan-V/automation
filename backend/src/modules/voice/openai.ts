import { ValidationError } from "../shared/errors.js";
import type { VoiceOutcome } from "./types.js";

export interface VoiceAiTurnResult {
  reply: string;
  endCall: boolean;
  outcome: VoiceOutcome | null;
}

interface OpenAiResponsesEnvelope {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

export function getOpenAiConfig() {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const useOpenRouter = Boolean(openRouterApiKey);

  return {
    provider: useOpenRouter ? "openrouter" : "openai",
    apiKey: useOpenRouter ? openRouterApiKey : openAiApiKey,
    model: useOpenRouter
      ? process.env.OPENROUTER_MODEL?.trim() ?? "openai/gpt-4.1-mini"
      : process.env.OPENAI_MODEL?.trim() ?? "gpt-4.1-mini",
    baseUrl: useOpenRouter
      ? process.env.OPENROUTER_BASE_URL?.trim() ?? "https://openrouter.ai/api/v1"
      : process.env.OPENAI_BASE_URL?.trim() ?? "https://api.openai.com/v1",
    httpReferer: process.env.OPENROUTER_HTTP_REFERER?.trim() ?? "",
    xTitle: process.env.OPENROUTER_X_TITLE?.trim() ?? "",
  };
}

export function isOpenAiConfigured() {
  return Boolean(getOpenAiConfig().apiKey);
}

function extractOutputText(payload: OpenAiResponsesEnvelope) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  throw new ValidationError("OpenAI returned an empty response.");
}

function parseAiResponse(payload: string): VoiceAiTurnResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new ValidationError("OpenAI response could not be parsed as JSON.");
  }

  if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
    throw new ValidationError("OpenAI response must be a JSON object.");
  }

  const candidate = parsed as Record<string, unknown>;
  const reply = typeof candidate.reply === "string" ? candidate.reply.trim() : "";
  const endCall = Boolean(candidate.endCall);
  const outcomeValue = candidate.outcome;

  const allowedOutcomes = new Set<VoiceOutcome>(["confirmed", "callback", "not_interested", "no_response", "unknown"]);
  const outcome =
    typeof outcomeValue === "string" && allowedOutcomes.has(outcomeValue as VoiceOutcome)
      ? (outcomeValue as VoiceOutcome)
      : null;

  if (!reply) {
    throw new ValidationError("OpenAI response is missing the spoken reply.");
  }

  return { reply, endCall, outcome };
}

export async function generateVoiceAiTurn(input: {
  objective: string;
  openingPrompt: string;
  systemPrompt?: string | null;
  transcript: string;
  latestUserMessage: string;
  language: string;
}): Promise<VoiceAiTurnResult> {
  const config = getOpenAiConfig();

  if (!config.apiKey) {
    throw new ValidationError("OPENAI_API_KEY or OPENROUTER_API_KEY is required for AI voice flows.");
  }

  const systemPrompt = [
    "You are a phone-call assistant speaking to a customer over Twilio.",
    `Speak in ${input.language || "es-MX"}.`,
    "Keep replies short, natural, and easy to understand aloud.",
    "Use at most two short sentences per turn.",
    "If the caller confirms, set outcome to confirmed and endCall to true.",
    "If the caller asks for a follow-up call, set outcome to callback and endCall to true.",
    "If the caller declines or is no longer interested, set outcome to not_interested and endCall to true.",
    "If there is no useful response, you may set outcome to no_response and endCall to true.",
    "If the conversation should continue, keep outcome as null and endCall as false.",
    `Call objective: ${input.objective}`,
    `Opening prompt already used in the call: ${input.openingPrompt}`,
    input.systemPrompt ? `Additional business instructions: ${input.systemPrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  if (config.provider === "openrouter") {
    if (config.httpReferer) {
      headers["HTTP-Referer"] = config.httpReferer;
    }
    if (config.xTitle) {
      headers["X-Title"] = config.xTitle;
    }
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Conversation transcript so far:",
                input.transcript || "(empty)",
                "",
                "Latest caller message:",
                input.latestUserMessage,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "voice_call_turn",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["reply", "endCall", "outcome"],
            properties: {
              reply: { type: "string" },
              endCall: { type: "boolean" },
              outcome: {
                anyOf: [
                  {
                    type: "string",
                    enum: ["confirmed", "callback", "not_interested", "no_response", "unknown"],
                  },
                  { type: "null" },
                ],
              },
            },
          },
        },
      },
    }),
  });

  const payload = (await response.json()) as OpenAiResponsesEnvelope;
  if (!response.ok) {
    throw new ValidationError(payload.error?.message ?? `${config.provider} request failed.`);
  }

  return parseAiResponse(extractOutputText(payload));
}
