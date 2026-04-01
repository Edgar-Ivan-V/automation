create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create extension if not exists vector with schema extensions;

do $$
declare
  tbl text;
  has_owner_id boolean;
begin
  foreach tbl in array array[
    'contacts',
    'conversations',
    'messages',
    'opportunities',
    'appointments',
    'automations'
  ]
  loop
    execute format('alter table public.%I add column if not exists organization_id uuid', tbl);
    execute format('alter table public.%I add column if not exists new_id uuid default gen_random_uuid()', tbl);
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'owner_id'
    ) into has_owner_id;
    if has_owner_id then
      execute format(
        'update public.%1$I t set organization_id = coalesce(t.organization_id, u.default_organization_id) from public.users u where u.id = t.owner_id and t.organization_id is null',
        tbl
      );
    end if;
  end loop;
end $$;

alter table public.contacts alter column new_id set not null;
alter table public.conversations alter column new_id set not null;
alter table public.messages alter column new_id set not null;
alter table public.opportunities alter column new_id set not null;
alter table public.appointments alter column new_id set not null;
alter table public.automations alter column new_id set not null;

alter table public.conversations add column if not exists contact_uuid uuid;
update public.conversations c
set contact_uuid = ct.new_id
from public.contacts ct
where ct.id = c.contact_id;

alter table public.messages add column if not exists conversation_uuid uuid;
update public.messages m
set conversation_uuid = c.new_id
from public.conversations c
where c.id = m.conversation_id;

alter table public.opportunities add column if not exists contact_uuid uuid;
update public.opportunities o
set contact_uuid = c.new_id
from public.contacts c
where c.id = o.contact_id;

alter table public.appointments add column if not exists contact_uuid uuid;
update public.appointments a
set contact_uuid = c.new_id
from public.contacts c
where c.id = a.contact_id;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  action text not null default 'system',
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.audit_logs add column if not exists organization_id uuid;
update public.audit_logs l
set organization_id = u.default_organization_id
from public.users u
where u.id = l.owner_id
  and l.organization_id is null;

-- Drop all FKs that reference the old text PKs before changing them
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'contact_note_embeddings'
  ) then
    execute 'alter table public.contact_note_embeddings drop constraint if exists contact_note_embeddings_contact_id_fkey';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'message_embeddings'
  ) then
    execute 'alter table public.message_embeddings drop constraint if exists message_embeddings_message_id_fkey';
  end if;
end $$;

alter table public.conversations drop constraint if exists conversations_contact_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_contact_id_fkey;
alter table public.appointments drop constraint if exists appointments_contact_id_fkey;
alter table public.messages drop constraint if exists messages_conversation_id_fkey;

alter table public.contacts drop constraint if exists contacts_pkey;
alter table public.contacts add primary key (new_id);
alter table public.contacts drop column if exists id;
alter table public.contacts rename column new_id to id;
alter table public.contacts alter column id set default gen_random_uuid();
alter table public.contacts alter column organization_id set not null;

-- Drop policies that reference columns being renamed/dropped
drop policy if exists "users manage own messages" on public.messages;

alter table public.conversations drop constraint if exists conversations_contact_id_fkey;
alter table public.conversations drop constraint if exists conversations_pkey;
alter table public.conversations add primary key (new_id);
alter table public.conversations drop column if exists id;
alter table public.conversations rename column new_id to id;
alter table public.conversations alter column id set default gen_random_uuid();
alter table public.conversations drop column if exists contact_id;
alter table public.conversations rename column contact_uuid to contact_id;
alter table public.conversations alter column contact_id set not null;
alter table public.conversations alter column organization_id set not null;

alter table public.messages drop constraint if exists messages_conversation_id_fkey;
alter table public.messages drop constraint if exists messages_pkey;
alter table public.messages add primary key (new_id);
alter table public.messages drop column if exists id;
alter table public.messages rename column new_id to id;
alter table public.messages alter column id set default gen_random_uuid();
alter table public.messages drop column if exists conversation_id;
alter table public.messages rename column conversation_uuid to conversation_id;
alter table public.messages alter column conversation_id set not null;
alter table public.messages alter column organization_id set not null;

alter table public.opportunities drop constraint if exists opportunities_contact_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_pkey;
alter table public.opportunities add primary key (new_id);
alter table public.opportunities drop column if exists id;
alter table public.opportunities rename column new_id to id;
alter table public.opportunities alter column id set default gen_random_uuid();
alter table public.opportunities drop column if exists contact_id;
alter table public.opportunities rename column contact_uuid to contact_id;
alter table public.opportunities alter column contact_id set not null;
alter table public.opportunities alter column organization_id set not null;

alter table public.appointments drop constraint if exists appointments_contact_id_fkey;
alter table public.appointments drop constraint if exists appointments_pkey;
alter table public.appointments add primary key (new_id);
alter table public.appointments drop column if exists id;
alter table public.appointments rename column new_id to id;
alter table public.appointments alter column id set default gen_random_uuid();
alter table public.appointments drop column if exists contact_id;
alter table public.appointments rename column contact_uuid to contact_id;
alter table public.appointments alter column organization_id set not null;

alter table public.automations drop constraint if exists automations_pkey;
alter table public.automations add primary key (new_id);
alter table public.automations drop column if exists id;
alter table public.automations rename column new_id to id;
alter table public.automations alter column id set default gen_random_uuid();
alter table public.automations alter column organization_id set not null;

-- Drop policies that depend on owner_id columns being removed
drop policy if exists "users manage own contacts" on public.contacts;
drop policy if exists "users manage own conversations" on public.conversations;
drop policy if exists "users manage own opportunities" on public.opportunities;
drop policy if exists "users manage own appointments" on public.appointments;
drop policy if exists "users manage own automations" on public.automations;

alter table public.contacts drop column if exists owner_id;
alter table public.conversations drop column if exists owner_id;
alter table public.opportunities drop column if exists owner_id;
alter table public.appointments drop column if exists owner_id;
alter table public.automations drop column if exists owner_id;

alter table public.contacts
  add constraint contacts_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.conversations
  add constraint conversations_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  add constraint conversations_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete cascade;

alter table public.messages
  add constraint messages_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  add constraint messages_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete cascade;

alter table public.opportunities
  add constraint opportunities_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  add constraint opportunities_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete cascade;

alter table public.appointments
  add constraint appointments_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  add constraint appointments_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete set null;

alter table public.automations
  add constraint automations_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  type text not null check (type in ('note', 'call', 'email', 'meeting', 'status_change', 'system')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_activities_entity on public.activities(entity_type, entity_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  unit_price numeric(12,2) not null default 0,
  stock numeric(12,4) not null default 0,
  low_stock_alert numeric(12,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  content_type text not null default 'article',
  body text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  title text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  hired_at date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Recreate embedding tables with UUID foreign keys (replacing text-based ones from pgvector migration)
drop table if exists public.contact_note_embeddings;
drop table if exists public.message_embeddings;

create table if not exists public.message_embeddings (
  message_id  uuid primary key references public.messages(id) on delete cascade,
  owner_id    uuid not null,
  content     text not null,
  embedding   extensions.vector(1536)
);
create index if not exists message_embeddings_owner_idx on public.message_embeddings (owner_id);
create index if not exists message_embeddings_ivfflat_idx on public.message_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

create table if not exists public.contact_note_embeddings (
  contact_id  uuid primary key references public.contacts(id) on delete cascade,
  owner_id    uuid not null,
  notes       text not null,
  embedding   extensions.vector(1536)
);
create index if not exists contact_note_embeddings_owner_idx on public.contact_note_embeddings (owner_id);
create index if not exists contact_note_embeddings_ivfflat_idx on public.contact_note_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

drop trigger if exists contacts_set_updated_at on public.contacts;
drop trigger if exists conversations_set_updated_at on public.conversations;
drop trigger if exists opportunities_set_updated_at on public.opportunities;
drop trigger if exists appointments_set_updated_at on public.appointments;
drop trigger if exists automations_set_updated_at on public.automations;

create trigger contacts_set_updated_at before update on public.contacts for each row execute procedure public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute procedure public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities for each row execute procedure public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute procedure public.set_updated_at();
create trigger automations_set_updated_at before update on public.automations for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute procedure public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices for each row execute procedure public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute procedure public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
create trigger employees_set_updated_at before update on public.employees for each row execute procedure public.set_updated_at();
