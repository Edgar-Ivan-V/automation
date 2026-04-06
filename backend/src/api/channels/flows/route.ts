/**
 * FILE: src/api/channels/flows/route.ts
 *
 * Handlers para POST/PATCH/DELETE /api/channels/flows.
 * Gestiona los flows de canales: las reglas trigger→action que definen
 * cuándo y cómo ejecutar una automatización en una plataforma.
 * Un flow vincula una cuenta, un agente (opcional) y una automatización,
 * y define el tipo de acción (publish_post, reply_dm…) con su configuración.
 *
 * Endpoints:
 *   POST   /api/channels/flows             → postChannelFlow (crear)
 *   PATCH  /api/channels/flows/:id         → patchChannelFlow (actualizar)
 *   DELETE /api/channels/flows/:id         → removeChannelFlow (eliminar)
 */

import { createChannelFlow, deleteChannelFlow, updateChannelFlow } from "../../../modules/channels/index.js";
import type { CreateChannelFlowInput, UpdateChannelFlowInput } from "../../../modules/channels/index.js";

export async function postChannelFlow(organizationId: string, body: Omit<CreateChannelFlowInput, "organizationId">) {
  return createChannelFlow({ organizationId, ...body });
}

export async function patchChannelFlow(organizationId: string, flowId: string, body: UpdateChannelFlowInput) {
  return updateChannelFlow(organizationId, flowId, body);
}

export async function removeChannelFlow(organizationId: string, flowId: string) {
  await deleteChannelFlow(organizationId, flowId);
  return { ok: true };
}
