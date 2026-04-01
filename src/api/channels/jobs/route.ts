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
