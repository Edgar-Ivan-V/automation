/**
 * FILE: src/modules/voice/services.ts
 *
 * Lógica de negocio del módulo de voz. Orquesta repositorios y la
 * integración con Twilio para implementar el flujo completo de
 * automatizaciones de llamadas salientes.
 *
 * Flujo principal:
 *   1. createCallJob()  → valida datos, crea el job en BD con status "queued"
 *   2. triggerCallJob() → inicia la llamada via Twilio, guarda el call SID
 *   3. Twilio llama a /webhooks/twilio/voice/twiml para obtener el guión TwiML
 *   4. El contacto presiona una tecla → /webhooks/twilio/voice/twiml/gather
 *   5. completeCallJobFromGather() → mapea la tecla al outcome y cierra el job
 *   6. Twilio notifica el estado final → /webhooks/twilio/voice/status
 *   7. handleTwilioCallStatus() → actualiza duración, recording URL, etc.
 *
 * Validaciones:
 *   - Números de teléfono en formato E.164 (+5215512345678)
 *   - Twilio debe estar configurado para crear/triggerear jobs
 *   - Agentes y flows deben pertenecer a la misma organización
 *
 * Exports principales:
 *   - listCallAgents / listCallFlows / listCallJobs (con paginación)
 *   - createCallAgent / createCallFlow / createCallJob
 *   - triggerCallJob: inicia la llamada real en Twilio
 *   - completeCallJobFromGather: procesa el DTMF y cierra el job
 *   - handleTwilioCallStatus: procesa el webhook de estado de Twilio
 *   - getVoiceAutomationSnapshot: retorna todos los datos para el dashboard
 */

import {
  createCallAgentRepository,
  createCallFlowRepository,
  createCallJobEventRepository,
  createCallJobRepository,
  getCallFlowRepository,
  getCallJobBySidRepository,
  getCallJobRepository,
  listCallAgentsRepository,
  listCallFlowsRepository,
  listCallJobsRepository,
  updateCallJobRepository
} from "./repositories.js";
import {
  buildAbsoluteWebhookUrl,
  createTwilioCall,
  getTwilioConfig,
  isTwilioConfigured
} from "./twilio.js";
import { generateVoiceAiTurn } from "./openai.js";
import { isElevenLabsConfigured } from "./elevenlabs.js";
import { requireServiceSupabaseClient } from "../shared/supabase-client.js";
import { NotFoundError, ValidationError } from "../shared/errors.js";
import { optionalString, requireNonEmptyString, requireNumber } from "../shared/validation.js";
import type {
  CallAgent,
  CallFlow,
  CallJob,
  CreateCallAgentInput,
  CreateCallFlowInput,
  CreateCallJobInput,
  VoiceBotStatus,
  VoiceCallStatus,
  VoiceFlowMode,
  VoiceOutcome
} from "./types.js";

const botStatuses = new Set<VoiceBotStatus>(["draft", "active", "paused"]);
const flowModes = new Set<VoiceFlowMode>(["dtmf", "ai", "realtime"]);

function parseBotStatus(value: unknown) {
  if (value == null || value === "") {
    return "draft" as const;
  }

  if (typeof value !== "string" || !botStatuses.has(value as VoiceBotStatus)) {
    throw new ValidationError("status must be one of draft, active, or paused.");
  }

  return value as VoiceBotStatus;
}

function parseFlowMode(value: unknown) {
  if (value == null || value === "") {
    return "dtmf" as const;
  }

  if (typeof value !== "string" || !flowModes.has(value as VoiceFlowMode)) {
    throw new ValidationError("mode must be one of dtmf, ai, or realtime.");
  }

  return value as VoiceFlowMode;
}

function parseMaxTurns(value: unknown) {
  if (value == null || value === "") {
    return 6;
  }

  const turns = Math.floor(requireNumber(value, "maxTurns"));
  if (turns < 1 || turns > 20) {
    throw new ValidationError("maxTurns must be between 1 and 20.");
  }

  return turns;
}

function getFlowMode(flow: CallFlow) {
  return flow.mode ?? "dtmf";
}

function getFlowMaxTurns(flow: CallFlow) {
  return flow.max_turns ?? 6;
}

function appendTranscript(transcript: string | null | undefined, ...entries: string[]) {
  return [...(transcript ? [transcript.trim()] : []), ...entries.map((entry) => entry.trim()).filter(Boolean)]
    .filter(Boolean)
    .join("\n");
}

function countCallerTurns(transcript: string | null | undefined) {
  if (!transcript) return 0;
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Caller:")).length;
}

function normalizePhone(value: string) {
  const normalized = requireNonEmptyString(value, "phone").replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new ValidationError("phone must be in E.164 format, for example +5215512345678.");
  }
  return normalized;
}

export async function listCallAgents(organizationId: string, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  return listCallAgentsRepository(client, requireNonEmptyString(organizationId, "organizationId"), pagination);
}

export async function createCallAgent(input: CreateCallAgentInput) {
  const client = requireServiceSupabaseClient();
  const config = getTwilioConfig();
  return createCallAgentRepository(client, {
    id: crypto.randomUUID(),
    organization_id: requireNonEmptyString(input.organizationId, "organizationId"),
    name: requireNonEmptyString(input.name, "name"),
    provider: "twilio",
    from_number: normalizePhone(input.fromNumber ?? config.defaultFromNumber),
    voice: optionalString(input.voice, "voice") ?? "alice",
    language: optionalString(input.language, "language") ?? "es-MX",
    intro_prompt: optionalString(input.introPrompt, "introPrompt"),
    status: parseBotStatus(input.status)
  } satisfies Partial<CallAgent>);
}

export async function listCallFlows(organizationId: string, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  return listCallFlowsRepository(client, requireNonEmptyString(organizationId, "organizationId"), pagination);
}

export async function createCallFlow(input: CreateCallFlowInput) {
  const client = requireServiceSupabaseClient();
  const payload: Partial<CallFlow> = {
    id: crypto.randomUUID(),
    organization_id: requireNonEmptyString(input.organizationId, "organizationId"),
    automation_id: optionalString(input.automationId, "automationId"),
    name: requireNonEmptyString(input.name, "name"),
    objective: requireNonEmptyString(input.objective, "objective"),
    target_entity_type: optionalString(input.targetEntityType, "targetEntityType"),
    prompt_template: requireNonEmptyString(input.promptTemplate, "promptTemplate"),
    success_key: optionalString(input.successKey, "successKey") ?? "1",
    success_label: optionalString(input.successLabel, "successLabel") ?? "confirmed",
    secondary_key: optionalString(input.secondaryKey, "secondaryKey") ?? "2",
    secondary_label: optionalString(input.secondaryLabel, "secondaryLabel") ?? "callback",
    fallback_key: optionalString(input.fallbackKey, "fallbackKey") ?? "3",
    fallback_label: optionalString(input.fallbackLabel, "fallbackLabel") ?? "not_interested",
    status: parseBotStatus(input.status)
  };

  if (input.mode !== undefined) payload.mode = parseFlowMode(input.mode);
  if (input.systemPrompt !== undefined) payload.system_prompt = optionalString(input.systemPrompt, "systemPrompt");
  if (input.maxTurns !== undefined) payload.max_turns = parseMaxTurns(input.maxTurns);

  return createCallFlowRepository(client, payload);
}

export async function listCallJobs(organizationId: string, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  return listCallJobsRepository(client, requireNonEmptyString(organizationId, "organizationId"), pagination);
}

export async function createCallJob(input: CreateCallJobInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const flowId = requireNonEmptyString(input.flowId, "flowId");
  const agentId = requireNonEmptyString(input.agentId, "agentId");
  const toNumber = normalizePhone(input.toNumber);

  const [agent, flow] = await Promise.all([
    client.from("call_agents").select("*").eq("organization_id", organizationId).eq("id", agentId).maybeSingle(),
    getCallFlowRepository(client, organizationId, flowId)
  ]);

  if (agent.error) {
    throw new Error(agent.error.message);
  }
  if (!agent.data) {
    throw new NotFoundError("Call agent not found.");
  }
  if (!flow) {
    throw new NotFoundError("Call flow not found.");
  }

  const job = await createCallJobRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    flow_id: flow.id,
    agent_id: agent.data.id,
    automation_id: optionalString(input.automationId, "automationId") ?? flow.automation_id,
    contact_id: optionalString(input.contactId, "contactId"),
    to_number: toNumber,
    from_number: agent.data.from_number,
    twilio_call_sid: null,
    status: "queued",
    outcome: null,
    provider: "twilio",
    provider_error: null,
    notes: optionalString(input.notes, "notes"),
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    answered_by: null,
    recording_url: null,
    transcript: null
  } satisfies Partial<CallJob>);

  await createCallJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    call_job_id: job.id,
    provider: "twilio",
    event_type: "queued",
    payload: {}
  });

  return job;
}

export async function triggerCallJob(organizationId: string, jobId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const normalizedJobId = requireNonEmptyString(jobId, "jobId");
  const job = await getCallJobRepository(client, normalizedOrganizationId, normalizedJobId);

  if (!job) {
    throw new NotFoundError("Call job not found.");
  }
  if (!isTwilioConfigured()) {
    throw new ValidationError("Twilio is not fully configured.");
  }

  const twilioCall = await createTwilioCall({
    to: job.to_number,
    from: job.from_number,
    url: buildAbsoluteWebhookUrl(`/api/webhooks/twilio/voice/twiml?jobId=${job.id}`),
    statusCallback: buildAbsoluteWebhookUrl("/api/webhooks/twilio/voice/status")
  });

  const updated = await updateCallJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    twilio_call_sid: twilioCall.sid ?? null,
    status: ((twilioCall.status as VoiceCallStatus | undefined) ?? "initiated"),
    provider_error: null
  });

  console.info("[voice.job] triggered", {
    jobId: updated.id,
    callSid: updated.twilio_call_sid,
    to: updated.to_number,
    from: updated.from_number,
    status: updated.status,
  });

  await createCallJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    call_job_id: updated.id,
    provider: "twilio",
    event_type: "triggered",
    payload: twilioCall as Record<string, unknown>
  });

  return updated;
}

export async function handleTwilioCallStatus(input: {
  callSid: string;
  callStatus: string;
  answeredBy?: string | null;
  duration?: string | null;
  recordingUrl?: string | null;
  rawPayload: Record<string, string>;
}) {
  const client = requireServiceSupabaseClient();
  const job = await getCallJobBySidRepository(client, requireNonEmptyString(input.callSid, "callSid"));
  if (!job) {
    throw new NotFoundError("Call job not found for Twilio SID.");
  }

  const payload: Partial<CallJob> = {
    status: normalizeCallStatus(input.callStatus),
    answered_by: optionalString(input.answeredBy, "answeredBy"),
    duration_seconds:
      input.duration != null && input.duration !== "" ? Math.max(0, Math.round(requireNumber(input.duration, "duration"))) : null,
    recording_url: optionalString(input.recordingUrl, "recordingUrl")
  };

  if (input.callStatus === "in-progress") {
    payload.started_at = new Date().toISOString();
  }
  if (["completed", "busy", "failed", "no-answer", "canceled"].includes(input.callStatus)) {
    payload.ended_at = new Date().toISOString();
  }

  const updated = await updateCallJobRepository(client, job.organization_id, job.id, payload);
  console.info("[voice.status] update", {
    jobId: job.id,
    callSid: input.callSid,
    status: updated.status,
    answeredBy: updated.answered_by,
    durationSeconds: updated.duration_seconds,
    recordingUrl: updated.recording_url,
  });

  await createCallJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: job.organization_id,
    call_job_id: job.id,
    provider: "twilio",
    event_type: input.callStatus,
    payload: input.rawPayload
  });
  return updated;
}

function normalizeCallStatus(status: string): VoiceCallStatus {
  const normalized = status.toLowerCase();
  if (normalized === "in-progress") return "answered";
  if (
    normalized === "queued" ||
    normalized === "initiated" ||
    normalized === "ringing" ||
    normalized === "answered" ||
    normalized === "completed" ||
    normalized === "busy" ||
    normalized === "failed" ||
    normalized === "no-answer" ||
    normalized === "canceled"
  ) {
    return normalized as VoiceCallStatus;
  }
  return "failed";
}

function mapDigitsToOutcome(flow: CallFlow, digits: string | null | undefined): VoiceOutcome {
  if (digits === flow.success_key) return "confirmed";
  if (digits === flow.secondary_key) return "callback";
  if (digits === flow.fallback_key) return "not_interested";
  return "no_response";
}

export async function completeCallJobFromGather(input: {
  jobId: string;
  digits?: string | null;
  speechResult?: string | null;
}) {
  const client = requireServiceSupabaseClient();
  const jobRecord = await client
    .from("call_jobs")
    .select("organization_id")
    .eq("id", requireNonEmptyString(input.jobId, "jobId"))
    .maybeSingle();
  if (jobRecord.error) {
    throw new Error(jobRecord.error.message);
  }
  if (!jobRecord.data) {
    throw new NotFoundError("Call job not found.");
  }
  const job = await getCallJobRepository(client, jobRecord.data.organization_id, input.jobId);
  if (!job) {
    throw new NotFoundError("Call job not found.");
  }
  const flow = await getCallFlowRepository(client, job.organization_id, job.flow_id);
  if (!flow) {
    throw new NotFoundError("Call flow not found.");
  }

  const transcript = optionalString(input.speechResult, "speechResult");
  const outcome = mapDigitsToOutcome(flow, optionalString(input.digits, "digits"));
  const updated = await updateCallJobRepository(client, job.organization_id, job.id, {
    outcome,
    transcript,
    status: "completed",
    ended_at: new Date().toISOString()
  });

  await createCallJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: job.organization_id,
    call_job_id: job.id,
    provider: "twilio",
    event_type: "gather.completed",
    payload: {
      digits: input.digits ?? null,
      speechResult: input.speechResult ?? null,
      outcome
    }
  });

  return { job: updated, flow };
}

export async function getCallConversationContext(jobId: string) {
  const client = requireServiceSupabaseClient();
  const { data, error } = await client
    .from("call_jobs")
    .select("*, flow:call_flows(*), agent:call_agents(*)")
    .eq("id", requireNonEmptyString(jobId, "jobId"))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new NotFoundError("Call job not found.");
  }

  const flow = Array.isArray((data as any).flow) ? (data as any).flow[0] : (data as any).flow;
  const agent = Array.isArray((data as any).agent) ? (data as any).agent[0] : (data as any).agent;

  if (!flow) {
    throw new NotFoundError("Call flow not found.");
  }
  if (!agent) {
    throw new NotFoundError("Call agent not found.");
  }

  return {
    client,
    job: data as unknown as CallJob,
    flow: flow as CallFlow,
    agent: agent as CallAgent,
  };
}

export async function processAiCallTurn(input: {
  jobId: string;
  digits?: string | null;
  speechResult?: string | null;
}) {
  const { client, job, flow, agent } = await getCallConversationContext(input.jobId);

  if (getFlowMode(flow) !== "ai") {
    throw new ValidationError("Flow is not configured for AI conversation.");
  }
  if (!isElevenLabsConfigured()) {
    throw new ValidationError("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID are required for AI voice flows.");
  }

  const digits = optionalString(input.digits, "digits");
  const speechResult = optionalString(input.speechResult, "speechResult");
  const now = new Date().toISOString();

  if (digits) {
    const outcome = mapDigitsToOutcome(flow, digits);
    const updated = await updateCallJobRepository(client, job.organization_id, job.id, {
      status: "completed",
      outcome,
      transcript: appendTranscript(job.transcript, `Caller: [keypad ${digits}]`),
      ended_at: now,
    });

    await createCallJobEventRepository(client, {
      id: crypto.randomUUID(),
      organization_id: job.organization_id,
      call_job_id: job.id,
      provider: "twilio",
      event_type: "ai.keypad.completed",
      payload: { digits, outcome },
    });

    console.info("[voice.ai] keypad", {
      jobId: job.id,
      digits,
      outcome,
    });

    return { job: updated, flow, agent, reply: `Gracias. Registramos ${outcome}.`, shouldHangup: true };
  }

  if (!speechResult) {
    const updated = await updateCallJobRepository(client, job.organization_id, job.id, {
      status: "completed",
      outcome: "no_response",
      transcript: appendTranscript(job.transcript, "Caller: [no response]"),
      ended_at: now,
    });

    await createCallJobEventRepository(client, {
      id: crypto.randomUUID(),
      organization_id: job.organization_id,
      call_job_id: job.id,
      provider: "twilio",
      event_type: "ai.no_response",
      payload: {},
    });

    console.info("[voice.ai] no_response", {
      jobId: job.id,
    });

    return { job: updated, flow, agent, reply: "No escuché una respuesta. Hasta luego.", shouldHangup: true };
  }

  console.info("[voice.ai] caller", {
    jobId: job.id,
    speechResult,
    previousTranscript: job.transcript ?? null,
  });

  const transcriptWithCaller = appendTranscript(job.transcript, `Caller: ${speechResult}`);
  const aiTurn = await generateVoiceAiTurn({
    objective: flow.objective,
    openingPrompt: flow.prompt_template,
    systemPrompt: flow.system_prompt ?? null,
    transcript: transcriptWithCaller,
    latestUserMessage: speechResult,
    language: agent.language,
  });

  const transcript = appendTranscript(transcriptWithCaller, `Assistant: ${aiTurn.reply}`);
  const reachedTurnLimit = countCallerTurns(transcript) >= getFlowMaxTurns(flow);
  const shouldHangup = aiTurn.endCall || reachedTurnLimit || aiTurn.outcome !== null;
  const outcome = shouldHangup ? aiTurn.outcome ?? "unknown" : null;

  const updated = await updateCallJobRepository(client, job.organization_id, job.id, {
    status: shouldHangup ? "completed" : "answered",
    outcome,
    transcript,
    ended_at: shouldHangup ? now : null,
  });

  await createCallJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: job.organization_id,
    call_job_id: job.id,
    provider: "twilio",
    event_type: shouldHangup ? "ai.completed" : "ai.turn",
    payload: {
      speechResult,
      reply: aiTurn.reply,
      outcome,
      reachedTurnLimit,
    },
  });

  console.info("[voice.ai] assistant", {
    jobId: job.id,
    reply: aiTurn.reply,
    outcome,
    shouldHangup,
    reachedTurnLimit,
  });

  return { job: updated, flow, agent, reply: aiTurn.reply, shouldHangup };
}

export async function getVoiceAutomationSnapshot(organizationId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const [agents, flows, jobs, contacts, automations] = await Promise.all([
    listCallAgentsRepository(client, normalizedOrganizationId),
    listCallFlowsRepository(client, normalizedOrganizationId),
    listCallJobsRepository(client, normalizedOrganizationId),
    client.from("contacts").select("id, full_name, phone, company").eq("organization_id", normalizedOrganizationId).order("full_name", { ascending: true }).limit(100),
    client.from("automations").select("id, name, description, trigger_type, action_type, status").eq("organization_id", normalizedOrganizationId).order("updated_at", { ascending: false }).limit(50)
  ]);

  if (contacts.error) throw new Error(contacts.error.message);
  if (automations.error) throw new Error(automations.error.message);

  return {
    configured: isTwilioConfigured(),
    aiConfigured: isElevenLabsConfigured(),
    aiProvider: "elevenlabs",
    agents,
    flows,
    jobs,
    contacts: contacts.data ?? [],
    automations: automations.data ?? []
  };
}
