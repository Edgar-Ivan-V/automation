/**
 * FILE: src/api/voice/agents/route.ts
 *
 * Handler del endpoint POST /api/voice/agents.
 * Crea un nuevo agente de voz (bot de llamadas) en la organización.
 * Un agente define el número de salida, la voz de Twilio, el idioma
 * y un prompt de introducción opcional que se lee al inicio de cada llamada.
 */

// POST /api/voice/agents
// Creates a new call agent linked to the authenticated organization.
import { createCallAgent } from "../../../modules/voice/index.js";
import type { CreateCallAgentInput } from "../../../modules/voice/index.js";

export async function postCallAgent(organizationId: string, body: Omit<CreateCallAgentInput, "organizationId">) {
  return createCallAgent({ organizationId, ...body });
}
