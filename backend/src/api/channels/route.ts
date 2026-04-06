/**
 * FILE: src/api/channels/route.ts
 *
 * Handler del endpoint GET /api/channels.
 * Retorna un snapshot completo de todos los datos de automatizaciones
 * de canales: catálogo de canales/acciones, accounts, agents, flows,
 * jobs, contactos y automatizaciones. Usado por el frontend para
 * cargar el dashboard de canales en un solo request.
 */

import { getChannelAutomationSnapshot } from "../../modules/channels/index.js";

export async function getChannelsSnapshot(organizationId: string) {
  return getChannelAutomationSnapshot(organizationId);
}
