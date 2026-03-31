import {
  createAutomationRepository,
  deleteAutomationRepository,
  getAutomationRepository,
  listAutomationsRepository,
  updateAutomationRepository,
} from "./repositories";
import { requireServiceSupabaseClient } from "../shared/supabase-client";
import { NotFoundError } from "../shared/errors";
import { optionalString, requireNonEmptyString } from "../shared/validation";
import type { AutomationStatus, CreateAutomationInput, UpdateAutomationInput } from "./types";

const validStatuses = new Set<AutomationStatus>(["draft", "active", "paused"]);

function parseStatus(value: unknown): AutomationStatus {
  if (value == null || value === "") return "draft";
  if (typeof value !== "string" || !validStatuses.has(value as AutomationStatus)) {
    throw new Error("status must be one of: draft, active, paused.");
  }
  return value as AutomationStatus;
}

export async function listAutomations(organizationId: string) {
  const client = requireServiceSupabaseClient();
  return listAutomationsRepository(client, requireNonEmptyString(organizationId, "organizationId"));
}

export async function getAutomation(organizationId: string, id: string) {
  const client = requireServiceSupabaseClient();
  const automation = await getAutomationRepository(
    client,
    requireNonEmptyString(organizationId, "organizationId"),
    requireNonEmptyString(id, "id")
  );
  if (!automation) throw new NotFoundError("Automation not found.");
  return automation;
}

export async function createAutomation(input: CreateAutomationInput) {
  const client = requireServiceSupabaseClient();
  return createAutomationRepository(client, {
    id: crypto.randomUUID(),
    organization_id: requireNonEmptyString(input.organizationId, "organizationId"),
    name: requireNonEmptyString(input.name, "name"),
    trigger_type: requireNonEmptyString(input.trigger_type, "trigger_type"),
    action_type: requireNonEmptyString(input.action_type, "action_type"),
    description: optionalString(input.description, "description"),
    status: parseStatus(input.status),
    runs_count: 0,
  });
}

export async function updateAutomation(organizationId: string, id: string, input: UpdateAutomationInput) {
  const client = requireServiceSupabaseClient();
  const orgId = requireNonEmptyString(organizationId, "organizationId");
  const automationId = requireNonEmptyString(id, "id");

  const existing = await getAutomationRepository(client, orgId, automationId);
  if (!existing) throw new NotFoundError("Automation not found.");

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.trigger_type !== undefined) patch.trigger_type = requireNonEmptyString(input.trigger_type, "trigger_type");
  if (input.action_type !== undefined) patch.action_type = requireNonEmptyString(input.action_type, "action_type");
  if (input.description !== undefined) patch.description = optionalString(input.description, "description");
  if (input.status !== undefined) patch.status = parseStatus(input.status);

  return updateAutomationRepository(client, orgId, automationId, patch);
}

export async function deleteAutomation(organizationId: string, id: string) {
  const client = requireServiceSupabaseClient();
  const orgId = requireNonEmptyString(organizationId, "organizationId");
  const automationId = requireNonEmptyString(id, "id");

  const existing = await getAutomationRepository(client, orgId, automationId);
  if (!existing) throw new NotFoundError("Automation not found.");

  await deleteAutomationRepository(client, orgId, automationId);
}
