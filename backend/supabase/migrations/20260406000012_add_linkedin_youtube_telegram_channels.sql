do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array['channel_accounts', 'channel_agents', 'channel_flows', 'channel_jobs']
  loop
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = table_name
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%channel%'
    loop
      execute format('alter table public.%I drop constraint %I', table_name, constraint_name);
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (channel in (''automations'', ''customer_support'', ''email'', ''facebook'', ''instagram'', ''linkedin'', ''youtube'', ''telegram'', ''x'', ''tiktok'', ''whatsapp'', ''messenger''))',
      table_name,
      table_name || '_channel_check'
    );
  end loop;
end $$;
