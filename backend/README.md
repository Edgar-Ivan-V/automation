# Automation Backend

Backend modules and API handlers for the automations system.

## What's included

### Modules (`src/modules/`)

| Module | Description |
|--------|-------------|
| `automations` | CRUD for automation records - trigger/action definitions |
| `voice` | Twilio outbound call bots with ElevenLabs AI voice flows |
| `channels` | Omnichannel social/email bots and jobs for Instagram, TikTok, WhatsApp, Messenger, X, Facebook, LinkedIn, YouTube, Telegram, Email |
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
| `/api/channels/oauth/meta/start` | GET | Start Meta OAuth for Facebook, Instagram, Messenger, or WhatsApp accounts |
| `/api/channels/oauth/meta/callback` | GET | Meta OAuth callback that creates a connected channel account |
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
| `ELEVENLABS_API_KEY` | Optional (AI voice) | API key used when a call flow runs in `ai` or `realtime` mode with ElevenLabs |
| `ELEVENLABS_AGENT_ID` | Optional (AI voice) | ElevenLabs agent ID used to register Twilio calls for AI conversations |
| `ELEVENLABS_BASE_URL` | Optional (AI voice) | Override base URL for ElevenLabs API, defaults to `https://api.elevenlabs.io/v1` |
| `OPENROUTER_API_KEY` | Optional (channel agents) | OpenRouter key used by channel agents; new agent configs default to `llmProvider=openrouter` |
| `OPENROUTER_MODEL` | Optional (channel agents) | OpenRouter model stored with new channel agent configs |
| `OPENROUTER_BASE_URL` | Optional (channel agents) | OpenRouter-compatible API base URL |
| `SOCIAL_OAUTH_REDIRECT_BASE_URL` | Optional (social login) | Public backend base URL used for OAuth callbacks |
| `META_GRAPH_API_VERSION` | Optional (social login) | Meta Graph API version used for login redirects and token exchange |
| `META_OAUTH_STATE_SECRET` | Optional (social login) | Secret used to sign OAuth state; falls back to `SUPABASE_SERVICE_ROLE_KEY` |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Yes (Facebook/Messenger/WhatsApp login) | Meta app credentials used to connect those channels |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Yes (Instagram login) | Meta app credentials used to connect Instagram |
| `FACEBOOK_OAUTH_SCOPES`, `INSTAGRAM_OAUTH_SCOPES`, `MESSENGER_OAUTH_SCOPES`, `WHATSAPP_OAUTH_SCOPES` | Optional (social login) | Comma-separated Meta OAuth scopes for each channel |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORGANIZATION_ID` | Optional (LinkedIn) | Credentials and organization id reserved for a future LinkedIn connector |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID` | Optional (YouTube) | Google/YouTube credentials reserved for a future YouTube connector |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID` | Optional (Telegram) | Telegram bot token and default chat id reserved for a future Telegram connector |

For `ai` and `realtime` flows, configure the ElevenLabs agent with Twilio-compatible audio (`mu-law 8000 Hz`) for both input and output.

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
