// POST /api/voice/flows
// Creates a new call flow, optionally linked to an automation.
import { createCallFlow } from "../../../modules/voice/index.js";
import type { CreateCallFlowInput } from "../../../modules/voice/index.js";

export async function postCallFlow(organizationId: string, body: Omit<CreateCallFlowInput, "organizationId">) {
  return createCallFlow({ organizationId, ...body });
}
