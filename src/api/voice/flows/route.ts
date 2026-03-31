// POST /api/voice/flows
// Creates a new call flow, optionally linked to an automation.
import { createCallFlow } from "../../../modules/voice";
import type { CreateCallFlowInput } from "../../../modules/voice";

export async function postCallFlow(organizationId: string, body: Omit<CreateCallFlowInput, "organizationId">) {
  return createCallFlow({ organizationId, ...body });
}
