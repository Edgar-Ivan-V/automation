# Automation

Backend modules and API handlers for the automations system.

## What's included

### Modules (`src/modules/`)

| Module | Description |
|--------|-------------|
| `automations` | CRUD for automation records — trigger/action definitions |
| `voice` | Twilio-powered outbound call bots (agents, flows, jobs) |
| `shared` | Supabase client, validation helpers, error types |

### API handlers (`src/api/`)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/voice` | GET | Snapshot of all voice automation data |
| `/api/voice/agents` | POST | Create a call agent |
| `/api/voice/flows` | POST | Create a call flow |
| `/api/voice/jobs` | POST | Create and trigger a call job |
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

## How automations work

```
automation (record: name, trigger_type, action_type, status)
  └── call_flow  →  defines the call script (prompt, DTMF keys)
        └── call_job  →  one outbound call execution
              └── call_job_events  →  Twilio event log per call
```

- An `automation` is a generic record describing what triggers something and what action to take.
- A `call_flow` is the voice-specific implementation, optionally linked to an automation.
- A `call_job` is a single call execution. It is created and immediately triggered via Twilio.
- Twilio webhooks update the job status and capture the caller's DTMF response.

## Setup

```bash
cp .env.example .env
npm install
```

Apply the Supabase migrations to your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side access |
| `TWILIO_ACCOUNT_SID` | Yes (voice) | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes (voice) | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Yes (voice) | E.164 phone number to call from |
| `TWILIO_WEBHOOK_BASE_URL` | Yes (voice) | Public base URL for Twilio webhooks |
