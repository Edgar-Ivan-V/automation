# Automation Monorepo

This repo is split into two sibling projects:

- `backend/`: Express + TypeScript API for AI-powered automations
- `frontend/`: React/Next.js-facing integration assets for the dashboard

The backend supports two modes: **Voice** (Twilio outbound calls) and **Channels** (omnichannel: Instagram, TikTok, WhatsApp, Email, etc.).

## Stack

- **Runtime**: Node.js (ESM, TypeScript)
- **Framework**: Express 4
- **Database**: Supabase (PostgreSQL + RLS)
- **Voice**: Twilio (outbound calls, TwiML, DTMF)
- **Validation**: Zod (env), custom validators (request bodies)

## Running locally

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set `DEV_BYPASS_AUTH=true` and `DEV_BYPASS_USER_ID=<your-user-uuid>` to skip JWT auth in development.

## Project structure

```text
automation/
  backend/
    src/
      server.ts              # Entry point: routes, middleware, error handler
      api/                   # Thin route handlers (parse req -> service -> res)
      modules/               # Business logic (no Express dependency)
    public/                  # Static files served by Express
    supabase/                # Migrations + seed data
    package.json
    Dockerfile
    fly.toml
  frontend/
    src/components/
      automations-page.tsx   # Dashboard integration component
    package.json
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Server + DB health check |
| GET | /api/me | Current user |
| GET | /api/voice | Voice snapshot (agents, flows, jobs) |
| GET | /api/voice/agents | Paginated call agents |
| GET | /api/voice/flows | Paginated call flows |
| GET | /api/voice/jobs | Paginated call jobs |
| POST | /api/voice/agents | Create call agent |
| POST | /api/voice/flows | Create call flow |
| POST | /api/voice/jobs | Create and trigger call job |
| GET | /api/channels | Channels snapshot |
| GET | /api/channels/accounts | Paginated channel accounts |
| GET | /api/channels/agents | Paginated channel agents |
| GET | /api/channels/flows | Paginated channel flows |
| GET | /api/channels/jobs | Paginated channel jobs |
| POST | /api/channels/jobs/:id/execute | Execute a job |
| POST | /api/channels/jobs/:id/retry | Retry a failed job |

Pagination params: `?limit=50&offset=0` (max limit: 200).

Authentication: pass `Authorization: Bearer <token>` or set `X-Organization-Id` header.

## Adding a channel connector

Channel jobs run in **preview mode** by default (no real API calls). To connect a real platform, register a connector at startup in `backend/src/server.ts`:

```typescript
import { registerChannelConnector } from "./modules/channels/connectors.js";

registerChannelConnector("instagram", {
  async execute(job, flow) {
    return {
      outcome: "published",
      summary: "Photo posted to feed.",
      resultPayload: { postId: "12345" },
    };
  },
});
```

Connectors are keyed by channel (`"instagram"`, `"whatsapp"`, `"email"`, etc.). If none is registered for a channel, execution falls back to preview mode.

## Database migrations

```bash
cd backend
supabase db push
supabase db reset
```

Migration files are in `backend/supabase/migrations/` and must be applied in order.

## Environment variables

See `backend/.env.example` for all variables. The server validates env at startup with Zod and exits immediately if required variables are missing.
