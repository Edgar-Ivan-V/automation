/**
 * FILE: src/modules/voice/types.ts
 *
 * Tipos TypeScript del módulo de automatizaciones de voz (Twilio).
 * Define las entidades de dominio y los inputs de los servicios.
 *
 * Entidades de base de datos:
 *   - CallAgent: bot de voz con número de salida, voz y prompt de intro
 *   - CallFlow: guión de la llamada (prompt, teclas DTMF, etiquetas)
 *   - CallJob: instancia de una llamada saliente a un contacto
 *   - CallJobEvent: log de eventos de estado de un CallJob
 *
 * Tipos de estado:
 *   - VoiceBotStatus: draft | active | paused (agentes y flows)
 *   - VoiceCallStatus: ciclo de vida de la llamada en Twilio
 *   - VoiceOutcome: resultado del DTMF (confirmed, callback, not_interested…)
 *
 * Inputs de creación usados por los servicios al recibir datos del request.
 */

export type VoiceBotStatus = "draft" | "active" | "paused";
export type VoiceFlowMode = "dtmf" | "ai" | "realtime";
export type VoiceCallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "answered"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";
export type VoiceOutcome = "confirmed" | "callback" | "not_interested" | "no_response" | "unknown";
export type VoiceProvider = "twilio";

export interface CallAgent {
  id: string;
  organization_id: string;
  name: string;
  provider: VoiceProvider;
  from_number: string;
  voice: string;
  language: string;
  intro_prompt: string | null;
  status: VoiceBotStatus;
  created_at: string;
  updated_at: string;
}

export interface CallFlow {
  id: string;
  organization_id: string;
  automation_id: string | null;
  name: string;
  objective: string;
  target_entity_type: string | null;
  prompt_template: string;
  mode?: VoiceFlowMode;
  system_prompt?: string | null;
  max_turns?: number | null;
  success_key: string;
  success_label: string;
  secondary_key: string;
  secondary_label: string;
  fallback_key: string;
  fallback_label: string;
  status: VoiceBotStatus;
  created_at: string;
  updated_at: string;
}

export interface CallJob {
  id: string;
  organization_id: string;
  flow_id: string;
  agent_id: string;
  automation_id: string | null;
  contact_id: string | null;
  to_number: string;
  from_number: string;
  twilio_call_sid: string | null;
  status: VoiceCallStatus;
  outcome: VoiceOutcome | null;
  provider: VoiceProvider;
  provider_error: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallJobEvent {
  id: string;
  organization_id: string;
  call_job_id: string;
  provider: VoiceProvider;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CreateCallAgentInput {
  organizationId: string;
  name: string;
  fromNumber?: string;
  voice?: string;
  language?: string;
  introPrompt?: string;
  status?: VoiceBotStatus;
}

export interface CreateCallFlowInput {
  organizationId: string;
  automationId?: string;
  name: string;
  objective: string;
  targetEntityType?: string;
  promptTemplate: string;
  mode?: VoiceFlowMode;
  systemPrompt?: string;
  maxTurns?: number;
  successKey?: string;
  successLabel?: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  fallbackKey?: string;
  fallbackLabel?: string;
  status?: VoiceBotStatus;
}

export interface CreateCallJobInput {
  organizationId: string;
  flowId: string;
  agentId: string;
  automationId?: string;
  contactId?: string;
  toNumber: string;
  notes?: string;
}

export interface UpdateCallFlowInput {
  automationId?: string;
  name?: string;
  objective?: string;
  targetEntityType?: string;
  promptTemplate?: string;
  mode?: VoiceFlowMode;
  systemPrompt?: string;
  maxTurns?: number;
  successKey?: string;
  successLabel?: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  fallbackKey?: string;
  fallbackLabel?: string;
  status?: VoiceBotStatus;
}
