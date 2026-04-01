export type ChannelKind = "automations" | "email" | "facebook" | "instagram" | "x" | "tiktok" | "whatsapp" | "messenger";
export type ChannelAccountStatus = "draft" | "connected" | "disconnected" | "error";
export type ChannelBotStatus = "draft" | "active" | "paused";
export type ChannelJobStatus = "draft" | "queued" | "scheduled" | "running" | "completed" | "failed" | "canceled" | "requires_auth";
export type ChannelJobOutcome = "published" | "sent" | "replied" | "lead_captured" | "scheduled" | "manual_review" | "unknown";

export interface ChannelAccount {
  id: string;
  organization_id: string;
  channel: ChannelKind;
  name: string;
  handle: string | null;
  provider: string;
  external_account_id: string | null;
  status: ChannelAccountStatus;
  metadata: Record<string, unknown>;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelAgent {
  id: string;
  organization_id: string;
  account_id: string;
  channel: ChannelKind;
  name: string;
  objective: string | null;
  persona_prompt: string | null;
  status: ChannelBotStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChannelFlow {
  id: string;
  organization_id: string;
  account_id: string;
  automation_id: string | null;
  agent_id: string | null;
  channel: ChannelKind;
  name: string;
  objective: string;
  trigger_type: string;
  action_type: string;
  content_type: string | null;
  prompt_template: string | null;
  action_config: Record<string, unknown>;
  status: ChannelBotStatus;
  created_at: string;
  updated_at: string;
}

export interface ChannelJob {
  id: string;
  organization_id: string;
  account_id: string;
  flow_id: string;
  agent_id: string | null;
  automation_id: string | null;
  contact_id: string | null;
  channel: ChannelKind;
  title: string;
  target_ref: string | null;
  payload: Record<string, unknown>;
  provider: string;
  provider_job_id: string | null;
  status: ChannelJobStatus;
  outcome: ChannelJobOutcome | null;
  provider_error: string | null;
  result_summary: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  result_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChannelJobEvent {
  id: string;
  organization_id: string;
  channel_job_id: string;
  provider: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ChannelActionDefinition {
  action_type: string;
  label: string;
  content_type?: string;
  description: string;
}

export interface CreateChannelAccountInput {
  organizationId: string;
  channel: ChannelKind;
  name: string;
  handle?: string;
  provider?: string;
  externalAccountId?: string;
  metadata?: Record<string, unknown>;
  status?: ChannelAccountStatus;
}

export interface UpdateChannelAccountInput {
  name?: string;
  handle?: string;
  provider?: string;
  externalAccountId?: string;
  metadata?: Record<string, unknown>;
  status?: ChannelAccountStatus;
}

export interface CreateChannelAgentInput {
  organizationId: string;
  accountId: string;
  channel: ChannelKind;
  name: string;
  objective?: string;
  personaPrompt?: string;
  status?: ChannelBotStatus;
  config?: Record<string, unknown>;
}

export interface UpdateChannelAgentInput {
  name?: string;
  objective?: string;
  personaPrompt?: string;
  status?: ChannelBotStatus;
  config?: Record<string, unknown>;
}

export interface CreateChannelFlowInput {
  organizationId: string;
  accountId: string;
  automationId?: string;
  agentId?: string;
  channel: ChannelKind;
  name: string;
  objective: string;
  triggerType: string;
  actionType: string;
  contentType?: string;
  promptTemplate?: string;
  actionConfig?: Record<string, unknown>;
  status?: ChannelBotStatus;
}

export interface UpdateChannelFlowInput {
  automationId?: string;
  agentId?: string;
  name?: string;
  objective?: string;
  triggerType?: string;
  actionType?: string;
  contentType?: string;
  promptTemplate?: string;
  actionConfig?: Record<string, unknown>;
  status?: ChannelBotStatus;
}

export interface CreateChannelJobInput {
  organizationId: string;
  accountId: string;
  flowId: string;
  agentId?: string;
  automationId?: string;
  contactId?: string;
  channel: ChannelKind;
  title: string;
  targetRef?: string;
  payload?: Record<string, unknown>;
  provider?: string;
  scheduledFor?: string;
}

export interface CompleteChannelJobInput {
  organizationId: string;
  jobId: string;
  resultSummary?: string;
  resultPayload?: Record<string, unknown>;
}
