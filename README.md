# Automation

This repository is now split into two sibling projects:

- [`backend/`](E:/proyects/automation/backend): Express + TypeScript API, Supabase migrations, Twilio voice flow, Dockerfile, and deploy config
- [`frontend/`](E:/proyects/automation/frontend): dashboard-facing React/Next.js integration assets

## Structure

```text
automation/
  backend/
    src/
    public/
    supabase/
    package.json
    Dockerfile
    fly.toml
  frontend/
    src/
    package.json
```

## Backend

```bash
cd backend
npm install
npm run dev
```

Detailed backend docs live in [backend/README.md](E:/proyects/automation/backend/README.md).

## Frontend

```bash
cd frontend
npm install
```

The current `frontend/` package is still a lightweight placeholder for the real Next.js app integration.
