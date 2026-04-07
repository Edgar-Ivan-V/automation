/**
 * FILE: src/modules/channels/repositories.ts
 *
 * Capa de acceso a datos del módulo de canales omnicanal. Todas las
 * queries a Supabase para accounts, agents, flows y jobs de canales
 * pasan por aquí. Los servicios nunca tocan Supabase directamente.
 *
 * Tablas que maneja:
 *   - channel_accounts: cuentas de plataformas conectadas (Instagram, WhatsApp…)
 *   - channel_agents: bots configurados sobre una cuenta
 *   - channel_flows: flujos trigger→action con plantilla de contenido
 *   - channel_jobs: ejecuciones concretas de un flow
 *   - channel_job_events: log de cada cambio de estado de un job
 *
 * Los listados incluyen JOINs con entidades relacionadas (account, agent,
 * contact, automation) para evitar N+1 queries en el snapshot.
 * Todas las queries filtran por organization_id (multi-tenant).
 * Los listados aceptan paginación opcional { limit, offset }.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNoError } from "../shared/supabase-client.js";
import type {
  ChannelAccount,
  ChannelAgent,
  ChannelFlow,
  ChannelJob,
  ChannelJobEvent,
  ChannelKind,
  CustomerSupportMessage,
  CustomerSupportSession,
} from "./types.js";

export async function listChannelAccountsRepository(client: SupabaseClient, organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  let query = client.from("channel_accounts").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false });
  if (channel) query = query.eq("channel", channel);
  if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as ChannelAccount[];
}

export async function createChannelAccountRepository(client: SupabaseClient, payload: Partial<ChannelAccount>) {
  const { data, error } = await client.from("channel_accounts").insert(payload).select().single();
  assertNoError(error);
  return data as ChannelAccount;
}

export async function getChannelAccountRepository(client: SupabaseClient, organizationId: string, accountId: string) {
  const { data, error } = await client.from("channel_accounts").select("*").eq("organization_id", organizationId).eq("id", accountId).maybeSingle();
  assertNoError(error);
  return (data ?? null) as ChannelAccount | null;
}

export async function getCustomerSupportAccountByWidgetKeyRepository(client: SupabaseClient, publicWidgetKey: string) {
  const { data, error } = await client
    .from("channel_accounts")
    .select("*")
    .eq("channel", "customer_support")
    .contains("metadata", { publicWidgetKey })
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as ChannelAccount | null;
}

export async function updateChannelAccountRepository(client: SupabaseClient, organizationId: string, accountId: string, payload: Partial<ChannelAccount>) {
  const { data, error } = await client.from("channel_accounts").update(payload).eq("organization_id", organizationId).eq("id", accountId).select().single();
  assertNoError(error);
  return data as ChannelAccount;
}

export async function deleteChannelAccountRepository(client: SupabaseClient, organizationId: string, accountId: string) {
  const { error } = await client.from("channel_accounts").delete().eq("organization_id", organizationId).eq("id", accountId);
  assertNoError(error);
}

export async function listChannelAgentsRepository(client: SupabaseClient, organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  let query = client.from("channel_agents").select("*, account:channel_accounts(id, name, handle, channel)").eq("organization_id", organizationId).order("updated_at", { ascending: false });
  if (channel) query = query.eq("channel", channel);
  if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as unknown as Array<ChannelAgent & { account?: Pick<ChannelAccount, "id" | "name" | "handle" | "channel"> | null }>;
}

export async function createChannelAgentRepository(client: SupabaseClient, payload: Partial<ChannelAgent>) {
  const { data, error } = await client.from("channel_agents").insert(payload).select().single();
  assertNoError(error);
  return data as ChannelAgent;
}

export async function getChannelAgentRepository(client: SupabaseClient, organizationId: string, agentId: string) {
  const { data, error } = await client.from("channel_agents").select("*").eq("organization_id", organizationId).eq("id", agentId).maybeSingle();
  assertNoError(error);
  return (data ?? null) as ChannelAgent | null;
}

export async function updateChannelAgentRepository(client: SupabaseClient, organizationId: string, agentId: string, payload: Partial<ChannelAgent>) {
  const { data, error } = await client.from("channel_agents").update(payload).eq("organization_id", organizationId).eq("id", agentId).select().single();
  assertNoError(error);
  return data as ChannelAgent;
}

export async function deleteChannelAgentRepository(client: SupabaseClient, organizationId: string, agentId: string) {
  const { error } = await client.from("channel_agents").delete().eq("organization_id", organizationId).eq("id", agentId);
  assertNoError(error);
}

export async function listChannelFlowsRepository(client: SupabaseClient, organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  let query = client
    .from("channel_flows")
    .select("*, account:channel_accounts(id, name, handle, channel), agent:channel_agents(id, name), automation:automations(id, name, trigger_type, action_type)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (channel) query = query.eq("channel", channel);
  if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as unknown as Array<ChannelFlow & { account?: Pick<ChannelAccount, "id" | "name" | "handle" | "channel"> | null; agent?: Pick<ChannelAgent, "id" | "name"> | null; automation?: { id: string; name: string; trigger_type: string; action_type: string } | null }>;
}

export async function createChannelFlowRepository(client: SupabaseClient, payload: Partial<ChannelFlow>) {
  const { data, error } = await client.from("channel_flows").insert(payload).select().single();
  assertNoError(error);
  return data as ChannelFlow;
}

export async function getChannelFlowRepository(client: SupabaseClient, organizationId: string, flowId: string) {
  const { data, error } = await client.from("channel_flows").select("*").eq("organization_id", organizationId).eq("id", flowId).maybeSingle();
  assertNoError(error);
  return (data ?? null) as ChannelFlow | null;
}

export async function updateChannelFlowRepository(client: SupabaseClient, organizationId: string, flowId: string, payload: Partial<ChannelFlow>) {
  const { data, error } = await client.from("channel_flows").update(payload).eq("organization_id", organizationId).eq("id", flowId).select().single();
  assertNoError(error);
  return data as ChannelFlow;
}

export async function deleteChannelFlowRepository(client: SupabaseClient, organizationId: string, flowId: string) {
  const { error } = await client.from("channel_flows").delete().eq("organization_id", organizationId).eq("id", flowId);
  assertNoError(error);
}

export async function listChannelJobsRepository(client: SupabaseClient, organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  let query = client
    .from("channel_jobs")
    .select("*, account:channel_accounts(id, name, handle, channel), agent:channel_agents(id, name), flow:channel_flows(id, name, action_type), contact:contacts(id, full_name, phone, company)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (channel) query = query.eq("channel", channel);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as unknown as Array<ChannelJob & { account?: Pick<ChannelAccount, "id" | "name" | "handle" | "channel"> | null; agent?: Pick<ChannelAgent, "id" | "name"> | null; flow?: Pick<ChannelFlow, "id" | "name" | "action_type"> | null; contact?: { id: string; full_name: string; phone: string | null; company: string | null } | null }>;
}

export async function createChannelJobRepository(client: SupabaseClient, payload: Partial<ChannelJob>) {
  const { data, error } = await client.from("channel_jobs").insert(payload).select().single();
  assertNoError(error);
  return data as ChannelJob;
}

export async function getChannelJobRepository(client: SupabaseClient, organizationId: string, jobId: string) {
  const { data, error } = await client.from("channel_jobs").select("*").eq("organization_id", organizationId).eq("id", jobId).maybeSingle();
  assertNoError(error);
  return (data ?? null) as ChannelJob | null;
}

export async function updateChannelJobRepository(client: SupabaseClient, organizationId: string, jobId: string, payload: Partial<ChannelJob>) {
  const { data, error } = await client.from("channel_jobs").update(payload).eq("organization_id", organizationId).eq("id", jobId).select().single();
  assertNoError(error);
  return data as ChannelJob;
}

export async function createChannelJobEventRepository(client: SupabaseClient, payload: Partial<ChannelJobEvent>) {
  const { data, error } = await client.from("channel_job_events").insert(payload).select().single();
  assertNoError(error);
  return data as ChannelJobEvent;
}

export async function createAppointmentFromChannelToolRepository(
  client: SupabaseClient,
  payload: {
    organization_id: string;
    contact_id: string | null;
    title: string;
    starts_at: string;
    ends_at: string;
    status: "scheduled";
    location: string | null;
    notes: string | null;
  }
) {
  const { data, error } = await client.from("appointments").insert(payload).select().single();
  assertNoError(error);
  return data as {
    id: string;
    organization_id: string;
    contact_id: string | null;
    title: string;
    starts_at: string;
    ends_at: string;
    status: string;
    location: string | null;
    notes: string | null;
  };
}

export async function createCustomerSupportSessionRepository(client: SupabaseClient, payload: Partial<CustomerSupportSession>) {
  const { data, error } = await client.from("customer_support_sessions").insert(payload).select().single();
  assertNoError(error);
  return data as CustomerSupportSession;
}

export async function listCustomerSupportSessionsRepository(client: SupabaseClient, organizationId: string, accountId?: string, pagination?: { limit: number; offset: number }) {
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  let query = client
    .from("customer_support_sessions")
    .select("*, account:channel_accounts(id, name, handle, metadata, channel), agent:channel_agents(id, name), flow:channel_flows(id, name, action_type)")
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as unknown as Array<CustomerSupportSession & {
    account?: Pick<ChannelAccount, "id" | "name" | "handle" | "metadata" | "channel"> | null;
    agent?: Pick<ChannelAgent, "id" | "name"> | null;
    flow?: Pick<ChannelFlow, "id" | "name"> & { action_type?: string | null } | null;
  }>;
}

export async function getCustomerSupportSessionRepository(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client
    .from("customer_support_sessions")
    .select("*, account:channel_accounts(id, name, handle, metadata, channel), agent:channel_agents(id, name), flow:channel_flows(id, name, action_type)")
    .eq("id", sessionId)
    .maybeSingle();
  assertNoError(error);
  return (data ?? null) as unknown as (CustomerSupportSession & {
    account?: Pick<ChannelAccount, "id" | "name" | "handle" | "metadata" | "channel"> | null;
    agent?: Pick<ChannelAgent, "id" | "name"> | null;
    flow?: Pick<ChannelFlow, "id" | "name"> & { action_type?: string | null } | null;
  }) | null;
}

export async function updateCustomerSupportSessionRepository(client: SupabaseClient, sessionId: string, payload: Partial<CustomerSupportSession>) {
  const { data, error } = await client.from("customer_support_sessions").update(payload).eq("id", sessionId).select().single();
  assertNoError(error);
  return data as CustomerSupportSession;
}

export async function listCustomerSupportMessagesRepository(client: SupabaseClient, sessionId: string) {
  const { data, error } = await client
    .from("customer_support_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  assertNoError(error);
  return (data ?? []) as CustomerSupportMessage[];
}

export async function createCustomerSupportMessageRepository(client: SupabaseClient, payload: Partial<CustomerSupportMessage>) {
  const { data, error } = await client.from("customer_support_messages").insert(payload).select().single();
  assertNoError(error);
  return data as CustomerSupportMessage;
}
