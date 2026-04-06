/**
 * FILE: src/api/voice/route.ts
 *
 * Handler del endpoint GET /api/voice.
 * Retorna un snapshot completo de todos los datos de automatizaciones
 * de voz de la organización: agentes, flows, jobs y contactos.
 * Usado por el frontend para cargar el dashboard de voz en un solo request.
 */

// GET /api/voice
// Returns a snapshot of all voice automation data for the authenticated organization.
import { getVoiceAutomationSnapshot } from "../../modules/voice/index.js";

export async function getVoiceSnapshot(organizationId: string) {
  return getVoiceAutomationSnapshot(organizationId);
}
