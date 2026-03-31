export type VoiceBotStatus = "draft" | "active" | "paused";
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
