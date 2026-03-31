create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  full_name text,
  role text not null default 'member',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contacts (
  id text primary key,
  owner_id uuid not null references public.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  company text,
  stage text not null default 'lead' check (stage in ('lead', 'qualified', 'proposal', 'customer')),
  source text,
  score integer not null default 50,
  tags text[] not null default '{}',
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id text primary key,
  contact_id text not null references public.contacts (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  channel text not null default 'sms' check (channel in ('sms', 'email', 'whatsapp', 'live_chat')),
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  subject text,
  unread_count integer not null default 0,
  last_message_preview text,
  last_message_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations (id) on delete cascade,
  sender_type text not null default 'user' check (sender_type in ('user', 'contact', 'system')),
  content text not null,
  delivered boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.opportunities (
  id text primary key,
  contact_id text not null references public.contacts (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  pipeline_stage text not null default 'new' check (pipeline_stage in ('new', 'qualified', 'proposal', 'won', 'lost')),
  value numeric(12, 2) not null default 0,
  probability integer not null default 0,
  expected_close_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id text primary key,
  contact_id text references public.contacts (id) on delete set null,
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  location text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automations (
  id text primary key,
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  description text,
  runs_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create or replace trigger contacts_set_updated_at before update on public.contacts
for each row execute procedure public.set_updated_at();
create or replace trigger conversations_set_updated_at before update on public.conversations
for each row execute procedure public.set_updated_at();
create or replace trigger opportunities_set_updated_at before update on public.opportunities
for each row execute procedure public.set_updated_at();
create or replace trigger appointments_set_updated_at before update on public.appointments
for each row execute procedure public.set_updated_at();
create or replace trigger automations_set_updated_at before update on public.automations
for each row execute procedure public.set_updated_at();

alter publication supabase_realtime add table public.messages;

alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.opportunities enable row level security;
alter table public.appointments enable row level security;
alter table public.automations enable row level security;

create policy "users manage own profile" on public.users for all
using (auth.uid() = id) with check (auth.uid() = id);
create policy "users manage own contacts" on public.contacts for all
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users manage own conversations" on public.conversations for all
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users manage own messages" on public.messages for all
using (exists (select 1 from public.conversations where conversations.id = messages.conversation_id and conversations.owner_id = auth.uid()))
with check (exists (select 1 from public.conversations where conversations.id = messages.conversation_id and conversations.owner_id = auth.uid()));
create policy "users manage own opportunities" on public.opportunities for all
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users manage own appointments" on public.appointments for all
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users manage own automations" on public.automations for all
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);



