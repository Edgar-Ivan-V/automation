/**
 * FILE: src/api/voice/flows/route.ts
 *
 * Handler del endpoint POST /api/voice/flows.
 * Crea un nuevo flow de llamada: el guión que se usa en una llamada saliente.
 * Un flow define el objetivo, el prompt que se lee al contacto, y el mapeo
 * de teclas DTMF a outcomes (ej: tecla 1 = "confirmed", tecla 2 = "callback").
 * Opcionalmente puede vincularse a una automatización existente.
 */

// POST /api/voice/flows
// Creates a new call flow, optionally linked to an automation.
import { createCallFlow } from "../../../modules/voice/index.js";
import type { CreateCallFlowInput } from "../../../modules/voice/index.js";

export async function postCallFlow(organizationId: string, body: Omit<CreateCallFlowInput, "organizationId">) {
  return createCallFlow({ organizationId, ...body });
}
