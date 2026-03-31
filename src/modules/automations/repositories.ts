import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNoError } from "../shared/supabase-client";
import type { Automation } from "./types";

export async function listAutomationsRepository(client: SupabaseClient, organizationId: string) {
  const { data, error } = await client
    .from("automations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  assertNoError(error);
  return (data ?? []) as Automation[];
}

export async function getAutomationRepository(client: SupabaseClient, organizationId: string, id: string) {
  const { data, error } = await client
    .from("automations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as Automation | null;
}

export async function createAutomationRepository(client: SupabaseClient, payload: Partial<Automation>) {
  const { data, error } = await client.from("automations").insert(payload).select().single();
  assertNoError(error);
  return data as Automation;
}

export async function updateAutomationRepository(
  client: SupabaseClient,
  organizationId: string,
  id: string,
  payload: Partial<Automation>
) {
  const { data, error } = await client
    .from("automations")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select()
    .single();
  assertNoError(error);
  return data as Automation;
}

export async function deleteAutomationRepository(client: SupabaseClient, organizationId: string, id: string) {
  const { error } = await client
    .from("automations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id);
  assertNoError(error);
}

export async function incrementRunsCountRepository(client: SupabaseClient, organizationId: string, id: string) {
  const { error } = await client.rpc("increment_automation_runs", {
    p_organization_id: organizationId,
    p_automation_id: id,
  });
  assertNoError(error);
}
