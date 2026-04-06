-- Development seed data for a fresh Supabase project.
-- Safe to re-run: inserts are idempotent.

create extension if not exists "pgcrypto";

do $$
declare
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_org_id uuid := '22222222-2222-2222-2222-222222222222';
  v_contact_ana_id uuid := '33333333-3333-3333-3333-333333333331';
  v_contact_luis_id uuid := '33333333-3333-3333-3333-333333333332';
  v_automation_id uuid := '44444444-4444-4444-4444-444444444444';
  v_agent_id uuid := '55555555-5555-5555-5555-555555555555';
  v_flow_id uuid := '66666666-6666-6666-6666-666666666666';
  v_job_queued_id uuid := '77777777-7777-7777-7777-777777777771';
  v_job_done_id uuid := '77777777-7777-7777-7777-777777777772';
  v_job_event_id uuid := '88888888-8888-8888-8888-888888888881';
begin
  if not exists (
    select 1
    from auth.users
    where id = v_user_id
  ) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'dev@automation.local',
      crypt('devpass123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dev User"}'::jsonb,
      now(),
      now()
    );
  end if;

  insert into public.organizations (id, name, slug, plan, settings)
  values (
    v_org_id,
    'Automation Dev Workspace',
    'automation-dev-workspace',
    'starter',
    '{"timezone":"America/Mexico_City","seeded":true}'::jsonb
  )
  on conflict (id) do update
  set
    name = excluded.name,
    slug = excluded.slug,
    plan = excluded.plan,
    settings = excluded.settings;

  insert into public.users (
    id,
    email,
    full_name,
    role,
    active_organization_id,
    default_organization_id
  )
  values (
    v_user_id,
    'dev@automation.local',
    'Dev User',
    'owner',
    v_org_id,
    v_org_id
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    active_organization_id = excluded.active_organization_id,
    default_organization_id = excluded.default_organization_id;

  insert into public.org_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner')
  on conflict (organization_id, user_id) do update
  set role = excluded.role;

  insert into public.contacts (
    id,
    organization_id,
    full_name,
    email,
    phone,
    company,
    stage,
    source,
    score,
    tags,
    notes,
    last_contacted_at
  )
  values
    (
      v_contact_ana_id,
      v_org_id,
      'Ana Torres',
      'ana@northwind.mx',
      '+525511111111',
      'Northwind Logistics',
      'qualified',
      'import',
      82,
      array['vip', 'appointment'],
      'Prefiere confirmaciones por llamada.',
      now() - interval '1 day'
    ),
    (
      v_contact_luis_id,
      v_org_id,
      'Luis Romero',
      'luis@fabrikam.mx',
      '+525522222222',
      'Fabrikam Services',
      'lead',
      'web',
      61,
      array['follow-up'],
      'Pidio devolucion de llamada por la tarde.',
      now() - interval '3 day'
    )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    company = excluded.company,
    stage = excluded.stage,
    source = excluded.source,
    score = excluded.score,
    tags = excluded.tags,
    notes = excluded.notes,
    last_contacted_at = excluded.last_contacted_at;

  insert into public.automations (
    id,
    organization_id,
    name,
    trigger_type,
    action_type,
    status,
    description,
    runs_count
  )
  values (
    v_automation_id,
    v_org_id,
    'Appointment Confirmation Bot',
    'scheduled_appointment',
    'voice_call',
    'active',
    'Llama automaticamente para confirmar citas del dia siguiente.',
    12
  )
  on conflict (id) do update
  set
    name = excluded.name,
    trigger_type = excluded.trigger_type,
    action_type = excluded.action_type,
    status = excluded.status,
    description = excluded.description,
    runs_count = excluded.runs_count;

  insert into public.call_agents (
    id,
    organization_id,
    name,
    provider,
    from_number,
    voice,
    language,
    intro_prompt,
    status
  )
  values (
    v_agent_id,
    v_org_id,
    'Collections Bot MX',
    'twilio',
    '+525533333333',
    'alice',
    'es-MX',
    'Hola, te llamamos de Automation Dev Workspace para confirmar tu cita.',
    'active'
  )
  on conflict (id) do update
  set
    name = excluded.name,
    from_number = excluded.from_number,
    voice = excluded.voice,
    language = excluded.language,
    intro_prompt = excluded.intro_prompt,
    status = excluded.status;

  insert into public.call_flows (
    id,
    organization_id,
    automation_id,
    name,
    objective,
    target_entity_type,
    prompt_template,
    success_key,
    success_label,
    secondary_key,
    secondary_label,
    fallback_key,
    fallback_label,
    status
  )
  values (
    v_flow_id,
    v_org_id,
    v_automation_id,
    'Appointment Confirmation',
    'Confirmar la asistencia a la cita de manana',
    'appointment',
    'Hola, esta es una llamada automatica para confirmar tu cita de manana. Presiona 1 para confirmar, 2 si necesitas que te llamemos, o 3 si ya no te interesa.',
    '1',
    'confirmed',
    '2',
    'callback',
    '3',
    'not_interested',
    'active'
  )
  on conflict (id) do update
  set
    automation_id = excluded.automation_id,
    name = excluded.name,
    objective = excluded.objective,
    target_entity_type = excluded.target_entity_type,
    prompt_template = excluded.prompt_template,
    success_key = excluded.success_key,
    success_label = excluded.success_label,
    secondary_key = excluded.secondary_key,
    secondary_label = excluded.secondary_label,
    fallback_key = excluded.fallback_key,
    fallback_label = excluded.fallback_label,
    status = excluded.status;

  insert into public.call_jobs (
    id,
    organization_id,
    flow_id,
    agent_id,
    automation_id,
    contact_id,
    to_number,
    from_number,
    twilio_call_sid,
    status,
    outcome,
    provider,
    notes,
    started_at,
    ended_at,
    duration_seconds,
    answered_by
  )
  values
    (
      v_job_queued_id,
      v_org_id,
      v_flow_id,
      v_agent_id,
      v_automation_id,
      v_contact_ana_id,
      '+525511111111',
      '+525533333333',
      null,
      'queued',
      null,
      'twilio',
      'Job listo para ser disparado manualmente.',
      null,
      null,
      null,
      null
    ),
    (
      v_job_done_id,
      v_org_id,
      v_flow_id,
      v_agent_id,
      v_automation_id,
      v_contact_luis_id,
      '+525522222222',
      '+525533333333',
      'CAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'completed',
      'callback',
      'twilio',
      'El contacto pidio una llamada de seguimiento.',
      now() - interval '2 hour',
      now() - interval '118 minute',
      120,
      'human'
    )
  on conflict (id) do update
  set
    flow_id = excluded.flow_id,
    agent_id = excluded.agent_id,
    automation_id = excluded.automation_id,
    contact_id = excluded.contact_id,
    to_number = excluded.to_number,
    from_number = excluded.from_number,
    twilio_call_sid = excluded.twilio_call_sid,
    status = excluded.status,
    outcome = excluded.outcome,
    notes = excluded.notes,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    duration_seconds = excluded.duration_seconds,
    answered_by = excluded.answered_by;

  insert into public.call_job_events (
    id,
    organization_id,
    call_job_id,
    provider,
    event_type,
    payload
  )
  values (
    v_job_event_id,
    v_org_id,
    v_job_done_id,
    'twilio',
    'completed',
    '{"CallStatus":"completed","Digits":"2","source":"seed"}'::jsonb
  )
  on conflict (id) do update
  set
    call_job_id = excluded.call_job_id,
    event_type = excluded.event_type,
    payload = excluded.payload;
end $$;

do $$
declare
  v_org_id uuid := '22222222-2222-2222-2222-222222222222';
  v_contact_ana_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_contact_luis_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_instagram_account_id uuid := '70000000-0000-0000-0000-000000000001';
  v_tiktok_account_id uuid := '70000000-0000-0000-0000-000000000002';
  v_whatsapp_account_id uuid := '70000000-0000-0000-0000-000000000003';
  v_instagram_agent_id uuid := '71000000-0000-0000-0000-000000000001';
  v_tiktok_agent_id uuid := '71000000-0000-0000-0000-000000000002';
  v_whatsapp_agent_id uuid := '71000000-0000-0000-0000-000000000003';
  v_instagram_flow_id uuid := '72000000-0000-0000-0000-000000000001';
  v_tiktok_flow_id uuid := '72000000-0000-0000-0000-000000000002';
  v_whatsapp_flow_id uuid := '72000000-0000-0000-0000-000000000003';
  v_instagram_job_id uuid := '73000000-0000-0000-0000-000000000001';
  v_tiktok_job_id uuid := '73000000-0000-0000-0000-000000000002';
  v_whatsapp_job_id uuid := '73000000-0000-0000-0000-000000000003';
  v_channel_event_id uuid := '74000000-0000-0000-0000-000000000001';
begin
  insert into public.channel_accounts (id, organization_id, channel, name, handle, provider, status, connected_at)
  values
    (v_instagram_account_id, v_org_id, 'instagram', 'Agency Hub IG', '@agencyhub', 'native', 'connected', now()),
    (v_tiktok_account_id, v_org_id, 'tiktok', 'Agency Hub TikTok', '@agencyhub', 'native', 'connected', now()),
    (v_whatsapp_account_id, v_org_id, 'whatsapp', 'WhatsApp MX', '+5215512345678', 'native', 'connected', now())
  on conflict (id) do update
  set name = excluded.name,
      handle = excluded.handle,
      status = excluded.status,
      connected_at = excluded.connected_at;

  insert into public.channel_agents (id, organization_id, account_id, channel, name, objective, persona_prompt, status)
  values
    (v_instagram_agent_id, v_org_id, v_instagram_account_id, 'instagram', 'IG Content Agent', 'Publicar fotos, historias y reels con tono de marca.', 'Habla como social media manager senior con tono cercano y comercial.', 'active'),
    (v_tiktok_agent_id, v_org_id, v_tiktok_account_id, 'tiktok', 'TikTok Video Agent', 'Preparar y lanzar videos cortos con CTA.', 'Optimiza hooks, ritmo y CTA para TikTok.', 'active'),
    (v_whatsapp_agent_id, v_org_id, v_whatsapp_account_id, 'whatsapp', 'WhatsApp Sales Agent', 'Responder conversaciones y capturar leads.', 'Responde rapido, califica lead y escala al equipo cuando haga falta.', 'active')
  on conflict (id) do update
  set objective = excluded.objective,
      persona_prompt = excluded.persona_prompt,
      status = excluded.status;

  insert into public.channel_flows (id, organization_id, account_id, agent_id, channel, name, objective, trigger_type, action_type, content_type, prompt_template, action_config, status)
  values
    (v_instagram_flow_id, v_org_id, v_instagram_account_id, v_instagram_agent_id, 'instagram', 'Instagram Stories Daily', 'Publicar historia diaria con CTA a DM.', 'schedule', 'publish_story', 'story', 'Usa tono visual de marca y CTA a mensaje directo.', '{"destination":"stories","assetType":"story"}'::jsonb, 'active'),
    (v_tiktok_flow_id, v_org_id, v_tiktok_account_id, v_tiktok_agent_id, 'tiktok', 'TikTok Launch Flow', 'Subir video con hook inicial y CTA al perfil.', 'manual', 'publish_video', 'video', 'Estructura hook, problema, solucion y CTA final.', '{"destination":"feed","assetType":"video"}'::jsonb, 'active'),
    (v_whatsapp_flow_id, v_org_id, v_whatsapp_account_id, v_whatsapp_agent_id, 'whatsapp', 'WhatsApp Lead Reply', 'Responder mensaje entrante y calificar lead.', 'reply_needed', 'reply_message', 'message', 'Confirma interes, pregunta presupuesto y agenda siguiente paso.', '{"channel":"inbox"}'::jsonb, 'active')
  on conflict (id) do update
  set objective = excluded.objective,
      trigger_type = excluded.trigger_type,
      action_type = excluded.action_type,
      content_type = excluded.content_type,
      prompt_template = excluded.prompt_template,
      action_config = excluded.action_config,
      status = excluded.status;

  insert into public.channel_jobs (id, organization_id, account_id, flow_id, agent_id, contact_id, channel, title, target_ref, payload, provider, status, outcome, result_summary, result_payload)
  values
    (v_instagram_job_id, v_org_id, v_instagram_account_id, v_instagram_flow_id, v_instagram_agent_id, v_contact_ana_id, 'instagram', 'Historia promocional', '@agencyhub', '{"caption":"Promocion semanal","assetUrl":"https://example.com/story.jpg"}'::jsonb, 'native', 'queued', 'manual_review', 'Job listo para conectar con Instagram Graph.', '{}'::jsonb),
    (v_tiktok_job_id, v_org_id, v_tiktok_account_id, v_tiktok_flow_id, v_tiktok_agent_id, v_contact_luis_id, 'tiktok', 'Video nuevo producto', '@agencyhub', '{"caption":"Nuevo lanzamiento","assetUrl":"https://example.com/video.mp4"}'::jsonb, 'native', 'queued', 'manual_review', 'Job listo para conectar con TikTok publishing.', '{}'::jsonb),
    (v_whatsapp_job_id, v_org_id, v_whatsapp_account_id, v_whatsapp_flow_id, v_whatsapp_agent_id, v_contact_ana_id, 'whatsapp', 'Respuesta a lead', '+5215512345678', '{"message":"Hola, gracias por escribirnos. Te contacto para ayudarte."}'::jsonb, 'native', 'queued', 'manual_review', 'Job listo para conectar con WhatsApp provider.', '{}'::jsonb)
  on conflict (id) do update
  set title = excluded.title,
      target_ref = excluded.target_ref,
      payload = excluded.payload,
      status = excluded.status,
      outcome = excluded.outcome,
      result_summary = excluded.result_summary;

  insert into public.channel_job_events (id, organization_id, channel_job_id, provider, event_type, payload)
  values (v_channel_event_id, v_org_id, v_whatsapp_job_id, 'native', 'queued', '{"source":"seed"}'::jsonb)
  on conflict (id) do update
  set channel_job_id = excluded.channel_job_id,
      event_type = excluded.event_type,
      payload = excluded.payload;
end $$;
