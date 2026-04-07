import { ValidationError } from "../shared/errors.js";

type ElevenLabsDirection = "inbound" | "outbound";

export interface RegisterTwilioCallInput {
  agentId?: string;
  fromNumber: string;
  toNumber: string;
  direction?: ElevenLabsDirection;
  conversationInitiationClientData?: Record<string, unknown>;
}

export function getElevenLabsConfig() {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() ?? "",
    agentId: process.env.ELEVENLABS_AGENT_ID?.trim() ?? "",
    baseUrl: process.env.ELEVENLABS_BASE_URL?.trim() ?? "https://api.elevenlabs.io/v1",
  };
}

export function isElevenLabsConfigured() {
  const config = getElevenLabsConfig();
  return Boolean(config.apiKey && config.agentId);
}

export async function registerTwilioCallWithElevenLabs(input: RegisterTwilioCallInput) {
  const config = getElevenLabsConfig();
  const agentId = input.agentId?.trim() || config.agentId;

  if (!config.apiKey || !agentId) {
    throw new ValidationError("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID are required for AI voice flows.");
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/convai/twilio/register-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      from_number: input.fromNumber,
      to_number: input.toNumber,
      direction: input.direction ?? "outbound",
      conversation_initiation_client_data: input.conversationInitiationClientData ?? undefined,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new ValidationError(text || "ElevenLabs register-call request failed.");
  }

  return text;
}
