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
