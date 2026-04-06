/**
 * FILE: src/api/voice/jobs/route.ts
 *
 * Handler del endpoint POST /api/voice/jobs.
 * Crea un job de llamada y de inmediato dispara la llamada saliente
 * via Twilio (createCallJob + triggerCallJob en un solo request).
 * El job requiere: un agente, un flow, y el número de destino (E.164).
 * Retorna el job actualizado con el Twilio call SID y status "initiated".
 */

// POST /api/voice/jobs
// Creates a call job and immediately triggers the Twilio call.
import { createCallJob, triggerCallJob } from "../../../modules/voice/index.js";
import type { CreateCallJobInput } from "../../../modules/voice/index.js";

export async function postCallJob(organizationId: string, body: Omit<CreateCallJobInput, "organizationId">) {
  const job = await createCallJob({ organizationId, ...body });
  return triggerCallJob(organizationId, job.id);
}
