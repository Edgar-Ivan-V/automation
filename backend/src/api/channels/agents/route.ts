/**
 * FILE: src/api/channels/agents/route.ts
 *
 * Handlers para POST/PATCH/DELETE /api/channels/agents.
 * Gestiona los agentes de canales: bots configurados sobre una cuenta
 * de plataforma con un objetivo específico y una persona de IA.
 * Un agente define el comportamiento del bot (qué hace, cómo se presenta)
 * y se vincula a flows para ejecutar acciones concretas.
 *
 * Endpoints:
 *   POST   /api/channels/agents            → postChannelAgent (crear)
 *   PATCH  /api/channels/agents/:id        → patchChannelAgent (actualizar)
 *   DELETE /api/channels/agents/:id        → removeChannelAgent (eliminar)
 */

import { createChannelAgent, deleteChannelAgent, updateChannelAgent } from "../../../modules/channels/index.js";
import type { CreateChannelAgentInput, UpdateChannelAgentInput } from "../../../modules/channels/index.js";

export async function postChannelAgent(organizationId: string, body: Omit<CreateChannelAgentInput, "organizationId">) {
  return createChannelAgent({ organizationId, ...body });
}

export async function patchChannelAgent(organizationId: string, agentId: string, body: UpdateChannelAgentInput) {
  return updateChannelAgent(organizationId, agentId, body);
}

export async function removeChannelAgent(organizationId: string, agentId: string) {
  await deleteChannelAgent(organizationId, agentId);
  return { ok: true };
}
