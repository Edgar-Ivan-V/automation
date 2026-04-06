/**
 * FILE: src/modules/voice/repositories.ts
 *
 * Capa de acceso a datos para el módulo de voz. Todas las queries
 * a las tablas de Supabase relacionadas con llamadas se hacen aquí.
 * Los servicios usan estas funciones; nunca acceden a Supabase directamente.
 *
 * Tablas que maneja:
 *   - call_agents: bots de voz con configuración de Twilio
 *   - call_flows: guiones DTMF (prompt + mapeo de teclas a outcomes)
 *   - call_jobs: llamadas salientes (una por contacto)
 *   - call_job_events: log de eventos de cada llamada
 *
 * Todas las queries están filtradas por organization_id para garantizar
 * aislamiento multi-tenant. Los listados aceptan paginación opcional
 * { limit, offset } que se aplica con .range() de Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNoError } from "../shared/supabase-client.js";
import type { CallAgent, CallFlow, CallJob, CallJobEvent } from "./types.js";

export async function listCallAgentsRepository(client: SupabaseClient, organizationId: string, pagination?: { limit: number; offset: number }) {
  let query = client
    .from("call_agents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as CallAgent[];
}

export async function createCallAgentRepository(client: SupabaseClient, payload: Partial<CallAgent>) {
  const { data, error } = await client.from("call_agents").insert(payload).select().single();
  assertNoError(error);
  return data as CallAgent;
}

export async function listCallFlowsRepository(client: SupabaseClient, organizationId: string, pagination?: { limit: number; offset: number }) {
  let query = client
    .from("call_flows")
    .select("*, automation:automations(id, name, trigger_type, action_type)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as unknown as Array<CallFlow & { automation?: { id: string; name: string; trigger_type: string; action_type: string } | null }>;
}

export async function getCallFlowRepository(client: SupabaseClient, organizationId: string, flowId: string) {
  const { data, error } = await client
    .from("call_flows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", flowId)
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as CallFlow | null;
}

export async function createCallFlowRepository(client: SupabaseClient, payload: Partial<CallFlow>) {
  const { data, error } = await client.from("call_flows").insert(payload).select().single();
  assertNoError(error);
  return data as CallFlow;
}

export async function listCallJobsRepository(client: SupabaseClient, organizationId: string, pagination?: { limit: number; offset: number }) {
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  const { data, error } = await client
    .from("call_jobs")
    .select(
      "*, contact:contacts(id, full_name, phone, company), agent:call_agents(id, name, from_number), flow:call_flows(id, name, objective)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  assertNoError(error);
  return (data ?? []) as unknown as Array<
    CallJob & {
      contact?: { id: string; full_name: string; phone: string | null; company: string | null } | null;
      agent?: { id: string; name: string; from_number: string } | null;
      flow?: { id: string; name: string; objective: string } | null;
    }
  >;
}

export async function getCallJobRepository(client: SupabaseClient, organizationId: string, jobId: string) {
  const { data, error } = await client
    .from("call_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as CallJob | null;
}

export async function getCallJobBySidRepository(client: SupabaseClient, callSid: string) {
  const { data, error } = await client
    .from("call_jobs")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as CallJob | null;
}

export async function createCallJobRepository(client: SupabaseClient, payload: Partial<CallJob>) {
  const { data, error } = await client.from("call_jobs").insert(payload).select().single();
  assertNoError(error);
  return data as CallJob;
}

export async function updateCallJobRepository(
  client: SupabaseClient,
  organizationId: string,
  jobId: string,
  payload: Partial<CallJob>
) {
  const { data, error } = await client
    .from("call_jobs")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .select()
    .single();
  assertNoError(error);
  return data as CallJob;
}

export async function createCallJobEventRepository(client: SupabaseClient, payload: Partial<CallJobEvent>) {
  const { data, error } = await client.from("call_job_events").insert(payload).select().single();
  assertNoError(error);
  return data as CallJobEvent;
}
