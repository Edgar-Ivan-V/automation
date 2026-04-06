alter table public.call_flows
  add column if not exists mode text not null default 'dtmf',
  add column if not exists system_prompt text,
  add column if not exists max_turns integer not null default 6;

update public.call_flows
set mode = coalesce(mode, 'dtmf'),
    max_turns = coalesce(max_turns, 6);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_flows_mode_check'
  ) then
    alter table public.call_flows
      add constraint call_flows_mode_check
      check (mode in ('dtmf', 'ai'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'call_flows_max_turns_check'
  ) then
    alter table public.call_flows
      add constraint call_flows_max_turns_check
      check (max_turns between 1 and 20);
  end if;
end $$;
