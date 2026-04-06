/**
 * FILE: src/modules/channels/types.ts
 *
 * Tipos TypeScript del módulo de automatizaciones de canales (omnicanal).
 * Define las entidades de dominio y los inputs de los servicios.
 *
 * Canales soportados (ChannelKind):
 *   customer_support, email, facebook, instagram, x, tiktok, whatsapp, messenger
 *
 * Entidades de base de datos:
 *   - ChannelAccount: cuenta conectada de una plataforma (ej: @miempresa en Instagram)
 *   - ChannelAgent: bot configurado sobre una cuenta con objetivo y persona
 *   - ChannelFlow: flujo de automatización: trigger + action + plantilla de contenido
 *   - ChannelJob: instancia de ejecución de un flow (un post, un DM, un email, etc.)
 *   - ChannelJobEvent: log de cada evento de estado de un ChannelJob
 *   - ChannelActionDefinition: catálogo de acciones disponibles por canal
 *
 * Tipos de estado:
 *   - ChannelAccountStatus: draft | connected | disconnected | error
 *   - ChannelBotStatus: draft | active | paused (agentes y flows)
 *   - ChannelJobStatus: ciclo de vida del job (queued → running → completed/failed)
 *   - ChannelJobOutcome: resultado final del job (published, sent, replied…)
 *
 * Inputs de creación/actualización usados por los servicios.
 */

export type ChannelKind = "customer_support" | "email" | "facebook" | "instagram" | "x" | "tiktok" | "whatsapp" | "messenger";
export type ChannelAccountStatus = "draft" | "connected" | "disconnected" | "error";
export type ChannelBotStatus = "draft" | "active" | "paused";
export type ChannelJobStatus = "draft" | "queued" | "scheduled" | "running" | "completed" | "failed" | "canceled" | "requires_auth";
export type ChannelJobOutcome = "published" | "sent" | "replied" | "lead_captured" | "scheduled" | "manual_review" | "unknown";
export type ChannelAgentType = "dm_responder" | "comment_responder" | "publisher" | "ads_operator";

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

export interface ChannelTriggerDefinition {
  trigger_type: string;
  label: string;
  description: string;
}

export interface ChannelAgentConfigFieldOption {
  value: string;
  label: string;
}

export interface ChannelAgentConfigFieldDefinition {
  key: string;
  label: string;
  description?: string;
  options: ChannelAgentConfigFieldOption[];
}

export interface ChannelAgentTypeDefinition {
  agent_type: ChannelAgentType;
  label: string;
  description: string;
  allowed_action_types: string[];
  config_fields: ChannelAgentConfigFieldDefinition[];
}

export interface ChannelSummaryMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
  description?: string;
}

export interface ChannelSummarySectionItem {
  key: string;
  label: string;
  value: number;
  description?: string;
}

export interface ChannelSummarySection {
  key: string;
  title: string;
  description?: string;
  items: ChannelSummarySectionItem[];
}

export interface ChannelSummary {
  channel: ChannelKind;
  connected: boolean;
  accountCount: number;
  connectedAccountCount: number;
  agentCount: number;
  flowCount: number;
  jobCount: number;
  metrics: ChannelSummaryMetric[];
  sections: ChannelSummarySection[];
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
  agentType?: ChannelAgentType;
  objective?: string;
  personaPrompt?: string;
  status?: ChannelBotStatus;
  config?: Record<string, unknown>;
}

export interface UpdateChannelAgentInput {
  name?: string;
  agentType?: ChannelAgentType;
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
