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
