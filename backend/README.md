# Automation Backend

Backend modules and API handlers for the automations system.

## What's included

### Modules (`src/modules/`)

| Module | Description |
|--------|-------------|
| `automations` | CRUD for automation records - trigger/action definitions |
| `voice` | Twilio-powered outbound call bots (agents, flows, jobs) |
| `channels` | Omnichannel social/email bots and jobs for Instagram, TikTok, WhatsApp, Messenger, X, Facebook, Email |
| `shared` | Supabase client, validation helpers, error types |

### API handlers (`src/api/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/me` | GET | Current authenticated Supabase user, profile, and organization memberships |
| `/api/me` | GET | Same as `/me`, namespaced under `/api` |
| `/api/voice` | GET | Snapshot of all voice automation data |
| `/api/voice/agents` | POST | Create a call agent |
| `/api/voice/flows` | POST | Create a call flow |
| `/api/voice/jobs` | POST | Create and trigger a call job |
| `/api/channels` | GET | Snapshot of omnichannel accounts, agents, flows, jobs, contacts and catalog |
| `/api/channels/accounts` | POST | Create a channel account |
| `/api/channels/agents` | POST | Create a channel agent |
| `/api/channels/flows` | POST | Create a channel flow |
| `/api/channels/jobs` | POST | Create a channel job |
| `/api/webhooks/twilio/voice/status` | POST | Twilio status callback |
| `/api/webhooks/twilio/voice/twiml` | POST | TwiML script for the call |
| `/api/webhooks/twilio/voice/twiml/gather` | POST | DTMF digit handler |

### Database (`supabase/migrations/`)

| Migration | Description |
|-----------|-------------|
| `20260324000000_init` | Base tables: users, contacts, conversations, automations |
| `20260328000001_organizations` | Multi-tenant organizations and org_members |
| `20260328000002_migrate_ids_to_uuid` | Converts text PKs to UUID, adds org scoping |
| `20260328000003_rls_multitenancy` | Row-level security policies |
| `20260329000007_voice_automations` | call_agents, call_flows, call_jobs, call_job_events |
| `20260331000008_channel_automations` | channel_accounts, channel_agents, channel_flows, channel_jobs, channel_job_events |

## How automations work

```text
automation (record: name, trigger_type, action_type, status)
  -> call_flow  -> defines the call script (prompt, DTMF keys)
       -> call_job  -> one outbound call execution
            -> call_job_events  -> Twilio event log per call
```

- An `automation` is a generic record describing what triggers something and what action to take.
- A `call_flow` is the voice-specific implementation, optionally linked to an automation.
- A `channel_flow` is the social/email implementation. It models actions like `publish_story`, `publish_video`, `reply_message`, `send_email`, etc.
- A `call_job` is a single call execution. It is created and immediately triggered via Twilio.
- Twilio webhooks update the job status and capture the caller's DTMF response.

## Setup

```bash
cd backend
cp .env.example .env
npm install
```

Apply the Supabase migrations to your project:

```bash
cd backend
supabase link --project-ref <your-project-ref>
supabase db push
```

Load the development seed into a fresh database:

- Local Supabase CLI: `cd backend && supabase db reset`
- Remote project: run [backend/supabase/seed.sql](E:/proyects/automation/backend/supabase/seed.sql) in the Supabase SQL Editor after `db push`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side access |
| `DEV_BYPASS_AUTH` | No | Set to `true` in local development to skip bearer auth and use a test user |
| `DEV_BYPASS_USER_ID` | No | Optional `public.users.id` used when `DEV_BYPASS_AUTH=true` |
| `TWILIO_ACCOUNT_SID` | Yes (voice) | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes (voice) | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Yes (voice) | E.164 phone number to call from |
| `TWILIO_WEBHOOK_BASE_URL` | Yes (voice) | Public base URL for Twilio webhooks |
| `OPENAI_API_KEY` | Optional (AI voice) | API key used when a call flow runs in `ai` mode with OpenAI |
| `OPENAI_MODEL` | Optional (AI voice) | OpenAI text model for spoken call turns, defaults to `gpt-4.1-mini` |
| `OPENAI_REALTIME_MODEL` | Optional (Realtime voice) | OpenAI realtime model, defaults to `gpt-realtime` |
| `OPENAI_REALTIME_VOICE` | Optional (Realtime voice) | Built-in realtime voice, defaults to `marin` |
| `OPENAI_REALTIME_TRANSCRIBE_MODEL` | Optional (Realtime voice) | Input transcription model, defaults to `gpt-4o-mini-transcribe` |
| `OPENROUTER_API_KEY` | Optional (AI voice) | If set, the backend uses OpenRouter instead of OpenAI |
| `OPENROUTER_MODEL` | Optional (AI voice) | OpenRouter model slug, defaults to `openai/gpt-4.1-mini` |

## Local auth bypass

For local-only testing, enable this in `.env`:

```env
DEV_BYPASS_AUTH=true
```

Behavior:

- `GET /me` and `GET /api/me` work without a bearer token
- the server uses the first row in `public.users`, unless `DEV_BYPASS_USER_ID` is set
- voice routes infer the organization from that user's active/default org or first membership
- if you send `X-Organization-Id`, that explicit value still wins

Seeded development data:

- User email: `dev@automation.local`
- User password: `devpass123`
- User id: `11111111-1111-1111-1111-111111111111`
- Organization id: `22222222-2222-2222-2222-222222222222`

Recommended `.env` for quick testing:

```env
DEV_BYPASS_AUTH=true
DEV_BYPASS_USER_ID=11111111-1111-1111-1111-111111111111
```
