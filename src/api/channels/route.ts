import { getChannelAutomationSnapshot } from "../../modules/channels/index.js";

export async function getChannelsSnapshot(organizationId: string) {
  return getChannelAutomationSnapshot(organizationId);
}
