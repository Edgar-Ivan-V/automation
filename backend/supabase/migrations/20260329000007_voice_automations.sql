create table if not exists public.call_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null default 'twilio' check (provider in ('twilio')),
  from_number text not null,
  voice text not null default 'alice',
  language text not null default 'es-MX',
  intro_prompt text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  name text not null,
  objective text not null,
  target_entity_type text,
  prompt_template text not null,
  success_key text not null default '1',
  success_label text not null default 'confirmed',
  secondary_key text not null default '2',
  secondary_label text not null default 'callback',
  fallback_key text not null default '3',
  fallback_label text not null default 'not_interested',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid not null references public.call_flows(id) on delete cascade,
  agent_id uuid not null references public.call_agents(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  to_number text not null,
  from_number text not null,
  twilio_call_sid text unique,
  status text not null default 'queued' check (status in ('queued', 'initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer', 'canceled')),
  outcome text check (outcome in ('confirmed', 'callback', 'not_interested', 'no_response', 'unknown')),
  provider text not null default 'twilio' check (provider in ('twilio')),
  provider_error text,
  notes text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  answered_by text,
  recording_url text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_job_id uuid not null references public.call_jobs(id) on delete cascade,
  provider text not null default 'twilio' check (provider in ('twilio')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_call_agents_org on public.call_agents(organization_id, updated_at desc);
create index if not exists idx_call_flows_org on public.call_flows(organization_id, updated_at desc);
create index if not exists idx_call_jobs_org on public.call_jobs(organization_id, created_at desc);
create index if not exists idx_call_jobs_sid on public.call_jobs(twilio_call_sid);
create index if not exists idx_call_job_events_org on public.call_job_events(organization_id, created_at desc);

drop trigger if exists call_agents_set_updated_at on public.call_agents;
create trigger call_agents_set_updated_at before update on public.call_agents for each row execute procedure public.set_updated_at();

drop trigger if exists call_flows_set_updated_at on public.call_flows;
create trigger call_flows_set_updated_at before update on public.call_flows for each row execute procedure public.set_updated_at();

drop trigger if exists call_jobs_set_updated_at on public.call_jobs;
create trigger call_jobs_set_updated_at before update on public.call_jobs for each row execute procedure public.set_updated_at();

alter table public.call_agents enable row level security;
alter table public.call_flows enable row level security;
alter table public.call_jobs enable row level security;
alter table public.call_job_events enable row level security;

create policy "org scoped call agents" on public.call_agents
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped call flows" on public.call_flows
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped call jobs" on public.call_jobs
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));

create policy "org scoped call job events" on public.call_job_events
  for all using (organization_id in (select organization_id from public.org_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.org_members where user_id = auth.uid()));
