alter table public.call_flows
  drop constraint if exists call_flows_mode_check;

alter table public.call_flows
  add constraint call_flows_mode_check
  check (mode in ('dtmf', 'ai', 'realtime'));
