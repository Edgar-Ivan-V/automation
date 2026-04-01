import { createChannelAgent, deleteChannelAgent, updateChannelAgent } from "../../../modules/channels/index.js";
import type { CreateChannelAgentInput, UpdateChannelAgentInput } from "../../../modules/channels/index.js";

export async function postChannelAgent(organizationId: string, body: Omit<CreateChannelAgentInput, "organizationId">) {
  return createChannelAgent({ organizationId, ...body });
}

export async function patchChannelAgent(organizationId: string, agentId: string, body: UpdateChannelAgentInput) {
  return updateChannelAgent(organizationId, agentId, body);
}

export async function removeChannelAgent(organizationId: string, agentId: string) {
  await deleteChannelAgent(organizationId, agentId);
  return { ok: true };
}
