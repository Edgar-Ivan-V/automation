create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members
    where organization_id = p_org_id
      and user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.activities enable row level security;
alter table public.products enable row level security;
alter table public.content_items enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.employees enable row level security;

drop policy if exists "users manage own contacts" on public.contacts;
drop policy if exists "users manage own conversations" on public.conversations;
drop policy if exists "users manage own messages" on public.messages;
drop policy if exists "users manage own opportunities" on public.opportunities;
drop policy if exists "users manage own appointments" on public.appointments;
drop policy if exists "users manage own automations" on public.automations;
drop policy if exists "users read own audit logs" on public.audit_logs;

create policy "users read org memberships" on public.org_members
for select using (user_id = auth.uid());

create policy "users read own organizations" on public.organizations
for select using (public.is_org_member(id));

drop policy if exists "users manage own profile" on public.users;
create policy "users manage own profile" on public.users
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "org scoped contacts" on public.contacts
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped conversations" on public.conversations
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped messages" on public.messages
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped opportunities" on public.opportunities
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped appointments" on public.appointments
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped automations" on public.automations
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped activities" on public.activities
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped products" on public.products
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped content_items" on public.content_items
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped invoices" on public.invoices
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped expenses" on public.expenses
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped projects" on public.projects
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped tasks" on public.tasks
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped employees" on public.employees
for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "org scoped audit_logs" on public.audit_logs
for select using (public.is_org_member(organization_id));
