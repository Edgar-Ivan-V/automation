/**
 * FILE: src/api/channels/accounts/route.ts
 *
 * Handlers para POST/PATCH/DELETE /api/channels/accounts.
 * Gestiona las cuentas de plataformas sociales conectadas a la organización.
 * Una cuenta representa la presencia de la empresa en un canal específico
 * (ej: la cuenta de Instagram @miempresa, el número de WhatsApp Business).
 * Sobre una cuenta se crean los agentes y flows del mismo canal.
 *
 * Endpoints:
 *   POST   /api/channels/accounts          → postChannelAccount (crear)
 *   PATCH  /api/channels/accounts/:id      → patchChannelAccount (actualizar)
 *   DELETE /api/channels/accounts/:id      → removeChannelAccount (eliminar)
 */

import { createChannelAccount, deleteChannelAccount, updateChannelAccount } from "../../../modules/channels/index.js";
import type { CreateChannelAccountInput, UpdateChannelAccountInput } from "../../../modules/channels/index.js";

export async function postChannelAccount(organizationId: string, body: Omit<CreateChannelAccountInput, "organizationId">) {
  return createChannelAccount({ organizationId, ...body });
}

export async function patchChannelAccount(organizationId: string, accountId: string, body: UpdateChannelAccountInput) {
  return updateChannelAccount(organizationId, accountId, body);
}

export async function removeChannelAccount(organizationId: string, accountId: string) {
  await deleteChannelAccount(organizationId, accountId);
  return { ok: true };
}
