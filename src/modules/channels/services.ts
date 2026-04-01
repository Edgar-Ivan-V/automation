import {
  createChannelAccountRepository,
  createChannelAgentRepository,
  createChannelFlowRepository,
  createChannelJobEventRepository,
  createChannelJobRepository,
  deleteChannelAccountRepository,
  deleteChannelAgentRepository,
  deleteChannelFlowRepository,
  getChannelAccountRepository,
  getChannelAgentRepository,
  getChannelFlowRepository,
  getChannelJobRepository,
  listChannelAccountsRepository,
  listChannelAgentsRepository,
  listChannelFlowsRepository,
  listChannelJobsRepository,
  updateChannelAccountRepository,
  updateChannelAgentRepository,
  updateChannelFlowRepository,
  updateChannelJobRepository
} from "./repositories.js";
import { CHANNEL_ACTIONS, isSupportedChannel } from "./catalog.js";
import { requireServiceSupabaseClient } from "../shared/supabase-client.js";
import { NotFoundError, ValidationError } from "../shared/errors.js";
import { optionalString, requireNonEmptyString } from "../shared/validation.js";
import type {
  ChannelAccountStatus,
  ChannelBotStatus,
  ChannelJobStatus,
  ChannelKind,
  CompleteChannelJobInput,
  CreateChannelAccountInput,
  CreateChannelAgentInput,
  CreateChannelFlowInput,
  CreateChannelJobInput,
  UpdateChannelAccountInput,
  UpdateChannelAgentInput,
  UpdateChannelFlowInput
} from "./types.js";

const accountStatuses = new Set<ChannelAccountStatus>(["draft", "connected", "disconnected", "error"]);
const botStatuses = new Set<ChannelBotStatus>(["draft", "active", "paused"]);
const jobStatuses = new Set<ChannelJobStatus>(["draft", "queued", "scheduled", "running", "completed", "failed", "canceled", "requires_auth"]);

function parseChannel(value: unknown, field = "channel"): ChannelKind {
  const channel = requireNonEmptyString(value, field);
  if (!isSupportedChannel(channel)) throw new ValidationError(`${field} is invalid.`);
  return channel;
}

function parseAccountStatus(value: unknown) {
  if (value == null || value === "") return "connected" as const;
  if (typeof value !== "string" || !accountStatuses.has(value as ChannelAccountStatus)) {
    throw new ValidationError("status must be one of draft, connected, disconnected, error.");
  }
  return value as ChannelAccountStatus;
}

function parseBotStatus(value: unknown) {
  if (value == null || value === "") return "draft" as const;
  if (typeof value !== "string" || !botStatuses.has(value as ChannelBotStatus)) {
    throw new ValidationError("status must be one of draft, active, paused.");
  }
  return value as ChannelBotStatus;
}

function parseJobStatus(value: unknown) {
  if (value == null || value === "") return "queued" as const;
  if (typeof value !== "string" || !jobStatuses.has(value as ChannelJobStatus)) {
    throw new ValidationError("status must be one of draft, queued, scheduled, running, completed, failed, canceled, requires_auth.");
  }
  return value as ChannelJobStatus;
}

function requireRecord(value: unknown, field: string) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function buildExecutionPreview(actionType: string) {
  if (actionType.startsWith("publish")) return { outcome: "published", summary: "Preview generated locally. Connect the platform provider to publish for real." } as const;
  if (actionType.startsWith("send")) return { outcome: "sent", summary: "Preview generated locally. Connect the provider to deliver the message for real." } as const;
  if (actionType.startsWith("reply")) return { outcome: "replied", summary: "Preview generated locally. Connect the platform inbox provider to reply for real." } as const;
  if (actionType.includes("lead")) return { outcome: "lead_captured", summary: "Lead handling simulated locally. Connect CRM or provider to complete the flow." } as const;
  return { outcome: "unknown", summary: "Execution completed in preview mode. External provider is still pending." } as const;
}

async function requireChannelAccount(organizationId: string, accountId: string) {
  const client = requireServiceSupabaseClient();
  const account = await getChannelAccountRepository(client, organizationId, accountId);
  if (!account) throw new NotFoundError("Channel account not found.");
  return { client, account };
}

async function requireChannelAgent(organizationId: string, agentId: string) {
  const client = requireServiceSupabaseClient();
  const agent = await getChannelAgentRepository(client, organizationId, agentId);
  if (!agent) throw new NotFoundError("Channel agent not found.");
  return { client, agent };
}

async function requireChannelFlow(organizationId: string, flowId: string) {
  const client = requireServiceSupabaseClient();
  const flow = await getChannelFlowRepository(client, organizationId, flowId);
  if (!flow) throw new NotFoundError("Channel flow not found.");
  return { client, flow };
}

async function requireChannelJob(organizationId: string, jobId: string) {
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, organizationId, jobId);
  if (!job) throw new NotFoundError("Channel job not found.");
  return { client, job };
}

export async function listChannelAccounts(organizationId: string, channel?: ChannelKind) {
  const client = requireServiceSupabaseClient();
  return listChannelAccountsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel);
}

export async function createChannelAccount(input: CreateChannelAccountInput) {
  const client = requireServiceSupabaseClient();
  const channel = parseChannel(input.channel);
  return createChannelAccountRepository(client, {
    id: crypto.randomUUID(),
    organization_id: requireNonEmptyString(input.organizationId, "organizationId"),
    channel,
    name: requireNonEmptyString(input.name, "name"),
    handle: optionalString(input.handle, "handle"),
    provider: optionalString(input.provider, "provider") ?? "native",
    external_account_id: optionalString(input.externalAccountId, "externalAccountId"),
    status: parseAccountStatus(input.status),
    metadata: requireRecord(input.metadata, "metadata"),
    connected_at: new Date().toISOString()
  });
}

export async function updateChannelAccount(organizationId: string, accountId: string, input: UpdateChannelAccountInput) {
  const { client, account } = await requireChannelAccount(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(accountId, "accountId"));
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.handle !== undefined) patch.handle = optionalString(input.handle, "handle");
  if (input.provider !== undefined) patch.provider = optionalString(input.provider, "provider") ?? account.provider;
  if (input.externalAccountId !== undefined) patch.external_account_id = optionalString(input.externalAccountId, "externalAccountId");
  if (input.status !== undefined) patch.status = parseAccountStatus(input.status);
  if (input.metadata !== undefined) patch.metadata = requireRecord(input.metadata, "metadata");
  return updateChannelAccountRepository(client, account.organization_id, account.id, patch);
}

export async function deleteChannelAccount(organizationId: string, accountId: string) {
  const { client, account } = await requireChannelAccount(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(accountId, "accountId"));
  await deleteChannelAccountRepository(client, account.organization_id, account.id);
}

export async function listChannelAgents(organizationId: string, channel?: ChannelKind) {
  const client = requireServiceSupabaseClient();
  return listChannelAgentsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel);
}

export async function createChannelAgent(input: CreateChannelAgentInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (account.channel !== channel) throw new ValidationError("Agent channel must match account channel.");
  return createChannelAgentRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    channel,
    name: requireNonEmptyString(input.name, "name"),
    objective: optionalString(input.objective, "objective"),
    persona_prompt: optionalString(input.personaPrompt, "personaPrompt"),
    status: parseBotStatus(input.status),
    config: requireRecord(input.config, "config")
  });
}

export async function updateChannelAgent(organizationId: string, agentId: string, input: UpdateChannelAgentInput) {
  const { client, agent } = await requireChannelAgent(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(agentId, "agentId"));
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.objective !== undefined) patch.objective = optionalString(input.objective, "objective");
  if (input.personaPrompt !== undefined) patch.persona_prompt = optionalString(input.personaPrompt, "personaPrompt");
  if (input.status !== undefined) patch.status = parseBotStatus(input.status);
  if (input.config !== undefined) patch.config = requireRecord(input.config, "config");
  return updateChannelAgentRepository(client, agent.organization_id, agent.id, patch);
}

export async function deleteChannelAgent(organizationId: string, agentId: string) {
  const { client, agent } = await requireChannelAgent(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(agentId, "agentId"));
  await deleteChannelAgentRepository(client, agent.organization_id, agent.id);
}

export async function listChannelFlows(organizationId: string, channel?: ChannelKind) {
  const client = requireServiceSupabaseClient();
  return listChannelFlowsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel);
}

export async function createChannelFlow(input: CreateChannelFlowInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (account.channel !== channel) throw new ValidationError("Flow channel must match account channel.");
  if (input.agentId) {
    const agent = await getChannelAgentRepository(client, organizationId, input.agentId);
    if (!agent) throw new NotFoundError("Channel agent not found.");
    if (agent.channel !== channel || agent.account_id !== account.id) throw new ValidationError("Flow agent must belong to the same channel account.");
  }
  return createChannelFlowRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    automation_id: optionalString(input.automationId, "automationId"),
    agent_id: optionalString(input.agentId, "agentId"),
    channel,
    name: requireNonEmptyString(input.name, "name"),
    objective: requireNonEmptyString(input.objective, "objective"),
    trigger_type: requireNonEmptyString(input.triggerType, "triggerType"),
    action_type: requireNonEmptyString(input.actionType, "actionType"),
    content_type: optionalString(input.contentType, "contentType"),
    prompt_template: optionalString(input.promptTemplate, "promptTemplate"),
    action_config: requireRecord(input.actionConfig, "actionConfig"),
    status: parseBotStatus(input.status)
  });
}

export async function updateChannelFlow(organizationId: string, flowId: string, input: UpdateChannelFlowInput) {
  const { client, flow } = await requireChannelFlow(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(flowId, "flowId"));
  const patch: Record<string, unknown> = {};
  if (input.agentId !== undefined) patch.agent_id = optionalString(input.agentId, "agentId");
  if (input.automationId !== undefined) patch.automation_id = optionalString(input.automationId, "automationId");
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.objective !== undefined) patch.objective = requireNonEmptyString(input.objective, "objective");
  if (input.triggerType !== undefined) patch.trigger_type = requireNonEmptyString(input.triggerType, "triggerType");
  if (input.actionType !== undefined) patch.action_type = requireNonEmptyString(input.actionType, "actionType");
  if (input.contentType !== undefined) patch.content_type = optionalString(input.contentType, "contentType");
  if (input.promptTemplate !== undefined) patch.prompt_template = optionalString(input.promptTemplate, "promptTemplate");
  if (input.actionConfig !== undefined) patch.action_config = requireRecord(input.actionConfig, "actionConfig");
  if (input.status !== undefined) patch.status = parseBotStatus(input.status);
  return updateChannelFlowRepository(client, flow.organization_id, flow.id, patch);
}

export async function deleteChannelFlow(organizationId: string, flowId: string) {
  const { client, flow } = await requireChannelFlow(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(flowId, "flowId"));
  await deleteChannelFlowRepository(client, flow.organization_id, flow.id);
}

export async function listChannelJobs(organizationId: string, channel?: ChannelKind) {
  const client = requireServiceSupabaseClient();
  return listChannelJobsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel);
}

export async function createChannelJob(input: CreateChannelJobInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (account.channel !== channel) throw new ValidationError("Job channel must match account channel.");
  const flow = await getChannelFlowRepository(client, organizationId, requireNonEmptyString(input.flowId, "flowId"));
  if (!flow) throw new NotFoundError("Channel flow not found.");
  if (flow.channel !== channel || flow.account_id !== account.id) throw new ValidationError("Job flow must belong to the same channel account.");

  let agentId: string | null = optionalString(input.agentId, "agentId");
  if (agentId) {
    const agent = await getChannelAgentRepository(client, organizationId, agentId);
    if (!agent) throw new NotFoundError("Channel agent not found.");
    if (agent.channel !== channel || agent.account_id !== account.id) throw new ValidationError("Job agent must belong to the same channel account.");
  } else {
    agentId = flow.agent_id;
  }

  const status = parseJobStatus(input.scheduledFor ? "scheduled" : undefined);
  const provider = optionalString(input.provider, "provider") ?? account.provider ?? "native";
  const job = await createChannelJobRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    flow_id: flow.id,
    agent_id: agentId,
    automation_id: optionalString(input.automationId, "automationId") ?? flow.automation_id,
    contact_id: optionalString(input.contactId, "contactId"),
    channel,
    title: requireNonEmptyString(input.title, "title"),
    target_ref: optionalString(input.targetRef, "targetRef"),
    payload: requireRecord(input.payload, "payload"),
    provider,
    provider_job_id: null,
    status,
    outcome: status === "scheduled" ? "scheduled" : "manual_review",
    provider_error: provider === "native" ? "Platform connector pending configuration." : null,
    result_summary: provider === "native" ? "Job created and waiting for a platform connector." : null,
    scheduled_for: optionalString(input.scheduledFor, "scheduledFor"),
    started_at: null,
    ended_at: null,
    result_payload: {}
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    channel_job_id: job.id,
    provider,
    event_type: "queued",
    payload: { flowId: flow.id, agentId, channel, title: job.title, targetRef: job.target_ref, payload: job.payload }
  });

  return job;
}

export async function executeChannelJob(organizationId: string, jobId: string) {
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const normalizedJobId = requireNonEmptyString(jobId, "jobId");
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, normalizedOrganizationId, normalizedJobId);
  if (!job) throw new NotFoundError("Channel job not found.");
  const flow = await getChannelFlowRepository(client, normalizedOrganizationId, job.flow_id);
  if (!flow) throw new NotFoundError("Channel flow not found.");

  const started = await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "running",
    provider_error: null,
    started_at: new Date().toISOString()
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: started.id,
    provider: started.provider,
    event_type: "running",
    payload: { actionType: flow.action_type, provider: started.provider }
  });

  const preview = buildExecutionPreview(flow.action_type);
  const completed = await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "completed",
    outcome: preview.outcome,
    result_summary: preview.summary,
    provider_error: started.provider === "native" ? "Preview mode only. External connector is not configured." : null,
    result_payload: { mode: "preview", channel: started.channel, actionType: flow.action_type, targetRef: started.target_ref, payload: started.payload },
    ended_at: new Date().toISOString()
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: completed.id,
    provider: completed.provider,
    event_type: "completed.preview",
    payload: completed.result_payload
  });

  return completed;
}

export async function retryChannelJob(organizationId: string, jobId: string) {
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const normalizedJobId = requireNonEmptyString(jobId, "jobId");
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, normalizedOrganizationId, normalizedJobId);
  if (!job) throw new NotFoundError("Channel job not found.");

  await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "queued",
    outcome: "manual_review",
    provider_error: null,
    result_summary: "Job requeued for preview execution.",
    started_at: null,
    ended_at: null,
    result_payload: {}
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: normalizedJobId,
    provider: job.provider,
    event_type: "requeued",
    payload: { previousStatus: job.status }
  });

  return executeChannelJob(normalizedOrganizationId, normalizedJobId);
}

export async function markChannelJobCompleted(input: CompleteChannelJobInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const jobId = requireNonEmptyString(input.jobId, "jobId");
  const updated = await updateChannelJobRepository(client, organizationId, jobId, {
    status: "completed",
    outcome: "published",
    result_summary: optionalString(input.resultSummary, "resultSummary") ?? "Job completed manually.",
    result_payload: requireRecord(input.resultPayload, "resultPayload"),
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    channel_job_id: updated.id,
    provider: updated.provider,
    event_type: "completed.manual",
    payload: updated.result_payload
  });

  return updated;
}

export async function getChannelAutomationSnapshot(organizationId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const [accounts, agents, flows, jobs, contacts, automations] = await Promise.all([
    listChannelAccountsRepository(client, normalizedOrganizationId),
    listChannelAgentsRepository(client, normalizedOrganizationId),
    listChannelFlowsRepository(client, normalizedOrganizationId),
    listChannelJobsRepository(client, normalizedOrganizationId),
    client.from("contacts").select("id, full_name, phone, company").eq("organization_id", normalizedOrganizationId).order("full_name", { ascending: true }).limit(100),
    client.from("automations").select("id, name, description, trigger_type, action_type, status").eq("organization_id", normalizedOrganizationId).order("updated_at", { ascending: false }).limit(50)
  ]);

  if (contacts.error) throw new Error(contacts.error.message);
  if (automations.error) throw new Error(automations.error.message);

  return {
    channels: Object.fromEntries(Object.entries(CHANNEL_ACTIONS).map(([channel, actions]) => [channel, { actions }])),
    accounts,
    agents,
    flows,
    jobs,
    contacts: contacts.data ?? [],
    automations: automations.data ?? []
  };
}
