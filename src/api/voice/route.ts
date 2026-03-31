// GET /api/voice
// Returns a snapshot of all voice automation data for the authenticated organization.
import { getVoiceAutomationSnapshot } from "../../modules/voice";

export async function getVoiceSnapshot(organizationId: string) {
  return getVoiceAutomationSnapshot(organizationId);
}
