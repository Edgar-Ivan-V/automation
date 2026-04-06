create table if not exists public.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('automations', 'email', 'facebook', 'instagram', 'x', 'tiktok', 'whatsapp', 'messenger')),
  name text not null,
  handle text,
  provider text not null default 'native',
  external_account_id text,
  status text not null default 'connected' check (status in ('draft', 'connected', 'disconnected', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.channel_accounts(id) on delete cascade,
  channel text not null check (channel in ('automations', 'email', 'facebook', 'instagram', 'x', 'tiktok', 'whatsapp', 'messenger')),
  name text not null,
  objective text,
  persona_prompt text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.channel_accounts(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  agent_id uuid references public.channel_agents(id) on delete set null,
  channel text not null check (channel in ('automations', 'email', 'facebook', 'instagram', 'x', 'tiktok', 'whatsapp', 'messenger')),
  name text not null,
  objective text not null,
  trigger_type text not null,
  action_type text not null,
  content_type text,
  prompt_template text,
  action_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.channel_accounts(id) on delete cascade,
  flow_id uuid not null references public.channel_flows(id) on delete cascade,
  agent_id uuid references public.channel_agents(id) on delete set null,
  automation_id uuid references public.automations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null check (channel in ('automations', 'email', 'facebook', 'instagram', 'x', 'tiktok', 'whatsapp', 'messenger')),
  title text not null,
  target_ref text,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'native',
  provider_job_id text,
  status text not null default 'queued' check (status in ('draft', 'queued', 'scheduled', 'running', 'completed', 'failed', 'canceled', 'requires_auth')),
  outcome text check (outcome in ('published', 'sent', 'replied', 'lead_captured', 'scheduled', 'manual_review', 'unknown')),
  provider_error text,
  result_summary text,
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_job_id uuid not null references public.channel_jobs(id) on delete cascade,
  provider text not null default 'native',
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_accounts_org on public.channel_accounts(organization_id, channel, updated_at desc);
create index if not exists idx_channel_agents_org on public.channel_agents(organization_id, channel, updated_at desc);
create index if not exists idx_channel_flows_org on public.channel_flows(organization_id, channel, updated_at desc);
create index if not exists idx_channel_jobs_org on public.channel_jobs(organization_id, channel, created_at desc);
create index if not exists idx_channel_job_events_org on public.channel_job_events(organization_id, created_at desc);

create index if not exists idx_channel_agents_account on public.channel_agents(account_id, updated_at desc);
create index if not exists idx_channel_flows_account on public.channel_flows(account_id, updated_at desc);
create index if not exists idx_channel_jobs_account on public.channel_jobs(account_id, created_at desc);

alter table public.channel_accounts enable row level security;
alter table public.channel_agents enable row level security;
alter table public.channel_flows enable row level security;
alter table public.channel_jobs enable row level security;
alter table public.channel_job_events enable row level security;

drop trigger if exists channel_accounts_set_updated_at on public.channel_accounts;
create trigger channel_accounts_set_updated_at before update on public.channel_accounts for each row execute procedure public.set_updated_at();

drop trigger if exists channel_agents_set_updated_at on public.channel_agents;
create trigger channel_agents_set_updated_at before update on public.channel_agents for each row execute procedure public.set_updated_at();

drop trigger if exists channel_flows_set_updated_at on public.channel_flows;
create trigger channel_flows_set_updated_at before update on public.channel_flows for each row execute procedure public.set_updated_at();

drop trigger if exists channel_jobs_set_updated_at on public.channel_jobs;
create trigger channel_jobs_set_updated_at before update on public.channel_jobs for each row execute procedure public.set_updated_at();

create policy "org scoped channel accounts" on public.channel_accounts
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped channel agents" on public.channel_agents
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped channel flows" on public.channel_flows
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped channel jobs" on public.channel_jobs
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped channel job events" on public.channel_job_events
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));
