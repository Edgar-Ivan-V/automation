/**
 * FILE: src/api/channels/jobs/route.ts
 *
 * Handlers para los endpoints de jobs de canales.
 * Un job es una ejecución concreta de un flow: publicar un post,
 * enviar un DM, mandar un email, etc. a un destinatario específico.
 *
 * Endpoints:
 *   POST /api/channels/jobs                  → postChannelJob (crear job)
 *   POST /api/channels/jobs/:id/execute      → postExecuteChannelJob
 *        Corre el job: si hay conector real lo usa, si no → preview mode
 *   POST /api/channels/jobs/:id/retry        → postRetryChannelJob
 *        Resetea el job a "queued" y lo re-ejecuta
 *   POST /api/channels/jobs/:id/complete     → postCompleteChannelJob
 *        Marca manualmente el job como completado con resultado externo
 */

import { createChannelJob, executeChannelJob, markChannelJobCompleted, retryChannelJob } from "../../../modules/channels/index.js";
import type { CompleteChannelJobInput, CreateChannelJobInput } from "../../../modules/channels/index.js";

export async function postChannelJob(organizationId: string, body: Omit<CreateChannelJobInput, "organizationId">) {
  return createChannelJob({ organizationId, ...body });
}

export async function postExecuteChannelJob(organizationId: string, jobId: string) {
  return executeChannelJob(organizationId, jobId);
}

export async function postRetryChannelJob(organizationId: string, jobId: string) {
  return retryChannelJob(organizationId, jobId);
}

export async function postCompleteChannelJob(organizationId: string, jobId: string, body: Omit<CompleteChannelJobInput, "organizationId" | "jobId">) {
  return markChannelJobCompleted({ organizationId, jobId, ...body });
}
