// POST /api/voice/jobs
// Creates a call job and immediately triggers the Twilio call.
import { createCallJob, triggerCallJob } from "../../../modules/voice";
import type { CreateCallJobInput } from "../../../modules/voice";

export async function postCallJob(organizationId: string, body: Omit<CreateCallJobInput, "organizationId">) {
  const job = await createCallJob({ organizationId, ...body });
  return triggerCallJob(organizationId, job.id);
}
