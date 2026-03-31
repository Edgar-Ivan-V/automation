// POST /api/voice/agents
// Creates a new call agent linked to the authenticated organization.
import { createCallAgent } from "../../../modules/voice";
import type { CreateCallAgentInput } from "../../../modules/voice";

export async function postCallAgent(organizationId: string, body: Omit<CreateCallAgentInput, "organizationId">) {
  return createCallAgent({ organizationId, ...body });
}
