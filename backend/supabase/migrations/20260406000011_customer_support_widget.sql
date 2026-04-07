create table if not exists public.customer_support_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.channel_accounts(id) on delete cascade,
  agent_id uuid references public.channel_agents(id) on delete set null,
  flow_id uuid references public.channel_flows(id) on delete set null,
  public_widget_key text not null,
  visitor_id text,
  visitor_name text,
  visitor_email text,
  visitor_metadata jsonb not null default '{}'::jsonb,
  source_url text,
  origin text,
  status text not null default 'active',
  summary text,
  handoff_requested_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint customer_support_sessions_status_check check (status in ('active', 'handoff_requested', 'resolved', 'closed'))
);

create table if not exists public.customer_support_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.customer_support_sessions(id) on delete cascade,
  role text not null,
  message_type text not null default 'text',
  content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint customer_support_messages_role_check check (role in ('visitor', 'assistant', 'system')),
  constraint customer_support_messages_type_check check (message_type in ('text', 'article', 'ticket', 'media', 'handoff'))
);

create index if not exists idx_customer_support_sessions_org on public.customer_support_sessions(organization_id, created_at desc);
create index if not exists idx_customer_support_sessions_account on public.customer_support_sessions(account_id, last_message_at desc);
create index if not exists idx_customer_support_sessions_widget on public.customer_support_sessions(public_widget_key, created_at desc);
create index if not exists idx_customer_support_messages_session on public.customer_support_messages(session_id, created_at asc);

alter table public.customer_support_sessions enable row level security;
alter table public.customer_support_messages enable row level security;

drop trigger if exists customer_support_sessions_set_updated_at on public.customer_support_sessions;
create trigger customer_support_sessions_set_updated_at before update on public.customer_support_sessions for each row execute procedure public.set_updated_at();

create policy "org scoped customer support sessions" on public.customer_support_sessions
  using (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid)
  with check (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);

create policy "org scoped customer support messages" on public.customer_support_messages
  using (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid)
  with check (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);
