create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

drop policy if exists "users manage own profile" on public.users;

alter table public.users
  alter column id type uuid using id::uuid;

create policy "users manage own profile" on public.users for all
using (auth.uid() = id) with check (auth.uid() = id);

alter table public.users
  add column if not exists active_organization_id uuid,
  add column if not exists default_organization_id uuid;

alter table public.users
  add constraint users_active_organization_id_fkey
  foreign key (active_organization_id) references public.organizations(id) on delete set null;

alter table public.users
  add constraint users_default_organization_id_fkey
  foreign key (default_organization_id) references public.organizations(id) on delete set null;

insert into public.organizations (name, slug, plan)
select
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'workspace') || ' Workspace',
  lower(regexp_replace(coalesce(nullif(split_part(u.email, '@', 1), ''), 'workspace') || '-' || substr(u.id::text, 1, 8), '[^a-z0-9-]+', '-', 'g')),
  'free'
from public.users u
where not exists (
  select 1
  from public.org_members m
  where m.user_id = u.id
);

insert into public.org_members (organization_id, user_id, role)
select o.id, u.id, 'owner'
from public.users u
join lateral (
  select id
  from public.organizations
  where slug like lower(regexp_replace(coalesce(nullif(split_part(u.email, '@', 1), ''), 'workspace') || '-%', '[^a-z0-9-]+', '-', 'g'))
  order by created_at asc
  limit 1
) o on true
where not exists (
  select 1
  from public.org_members m
  where m.user_id = u.id
);

update public.users u
set
  default_organization_id = m.organization_id,
  active_organization_id = m.organization_id
from public.org_members m
where m.user_id = u.id
  and (u.default_organization_id is null or u.active_organization_id is null);
