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
} from "./repositories";
import {
  buildAbsoluteWebhookUrl,
  createTwilioCall,
  getTwilioConfig,
  isTwilioConfigured
} from "./twilio";
import { requireServiceSupabaseClient } from "../shared/supabase-client";
import { NotFoundError, ValidationError } from "../shared/errors";
import { optionalString, requireNonEmptyString, requireNumber } from "../shared/validation";
import type {
  CallAgent,
  CallFlow,
  CallJob,
  CreateCallAgentInput,
  CreateCallFlowInput,
  CreateCallJobInput,
  VoiceBotStatus,
  VoiceCallStatus,
  VoiceOutcome
} from "./types";

const botStatuses = new Set<VoiceBotStatus>(["draft", "active", "paused"]);

function parseBotStatus(value: unknown) {
  if (value == null || value === "") {
    return "draft" as const;
  }

  if (typeof value !== "string" || !botStatuses.has(value as VoiceBotStatus)) {
    throw new ValidationError("status must be one of draft, active, or paused.");
  }

  return value as VoiceBotStatus;
}

function normalizePhone(value: string) {
  const normalized = requireNonEmptyString(value, "phone").replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new ValidationError("phone must be in E.164 format, for example +5215512345678.");
  }
  return normalized;
}

export async function listCallAgents(organizationId: string) {
  const client = requireServiceSupabaseClient();
  return listCallAgentsRepository(client, requireNonEmptyString(organizationId, "organizationId"));
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

export async function listCallFlows(organizationId: string) {
  const client = requireServiceSupabaseClient();
  return listCallFlowsRepository(client, requireNonEmptyString(organizationId, "organizationId"));
}

export async function createCallFlow(input: CreateCallFlowInput) {
  const client = requireServiceSupabaseClient();
  return createCallFlowRepository(client, {
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
  } satisfies Partial<CallFlow>);
}

export async function listCallJobs(organizationId: string) {
  const client = requireServiceSupabaseClient();
  return listCallJobsRepository(client, requireNonEmptyString(organizationId, "organizationId"));
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

export async function getVoiceAutomationSnapshot(organizationId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const [agents, flows, jobs, contacts, automations] = await Promise.all([
    listCallAgentsRepository(client, normalizedOrganizationId),
    listCallFlowsRepository(client, normalizedOrganizationId),
    listCallJobsRepository(client, normalizedOrganizationId),
    client.from("contacts").select("id, full_name, phone, company").eq("organization_id", normalizedOrganizationId).order("full_name", { ascending: true }).limit(100),
    client.from("automations").select("id, name, trigger_type, action_type, status").eq("organization_id", normalizedOrganizationId).order("updated_at", { ascending: false }).limit(50)
  ]);

  if (contacts.error) throw new Error(contacts.error.message);
  if (automations.error) throw new Error(automations.error.message);

  return {
    configured: isTwilioConfigured(),
    agents,
    flows,
    jobs,
    contacts: contacts.data ?? [],
    automations: automations.data ?? []
  };
}
