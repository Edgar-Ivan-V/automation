/**
 * FILE: src/server.ts
 *
 * Punto de entrada del backend. Configura y arranca el servidor Express.
 * Toda la arquitectura de rutas, middleware y manejo de errores vive aquí.
 *
 * Middleware (en orden de ejecución):
 *   1. validateEnv()      → valida variables de entorno al inicio, falla rápido
 *   2. morgan             → logging de requests HTTP (dev en local, combined en prod)
 *   3. express-rate-limit → 200 req/min por IP, protección básica contra abuso
 *   4. express.static     → sirve /public/ (frontend estático)
 *   5. express.json       → parsea body JSON
 *   6. express.urlencoded → parsea body form-encoded (webhooks de Twilio)
 *
 * Rutas registradas:
 *   GET  /health                           → health check (server + Supabase)
 *   GET  /api/me                           → usuario autenticado actual
 *   GET  /api/voice                        → snapshot de voz
 *   GET  /api/voice/agents|flows|jobs      → listados paginados (?limit, ?offset)
 *   POST /api/voice/agents|flows|jobs      → crear entidades de voz
 *   GET  /api/channels                     → snapshot de canales
 *   GET  /api/channels/accounts|agents|flows|jobs → listados paginados
 *   POST /api/channels/accounts|agents|flows|jobs → crear entidades
 *   PATCH/DELETE /api/channels/...         → actualizar / eliminar entidades
 *   POST /api/channels/jobs/:id/execute|retry|complete → ciclo de vida del job
 *   POST /api/webhooks/twilio/voice/twiml  → TwiML para llamadas activas
 *   POST /api/webhooks/twilio/voice/twiml/gather → captura DTMF
 *   POST /api/webhooks/twilio/voice/status → notificaciones de estado de Twilio
 *
 * Error handler global:
 *   ValidationError → 400, NotFoundError → 404, UnauthorizedError → 401
 *   Cualquier otro → 500 con "Internal server error."
 *
 * Auth:
 *   getOrganizationId() resuelve la org del request desde el header
 *   X-Organization-Id, query param org_id, o la org activa del usuario.
 */

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { validateEnv } from "./modules/shared/env.js";
import { getCurrentUser, resolveOrganizationId } from "./api/me/route.js";
import { getVoiceSnapshot } from "./api/voice/route.js";
import { getChannelsSnapshot } from "./api/channels/route.js";
import { postCallAgent } from "./api/voice/agents/route.js";
import { postCallFlow } from "./api/voice/flows/route.js";
import { postCallJob } from "./api/voice/jobs/route.js";
import { patchChannelAccount, postChannelAccount, removeChannelAccount } from "./api/channels/accounts/route.js";
import { patchChannelAgent, postChannelAgent, removeChannelAgent } from "./api/channels/agents/route.js";
import { patchChannelFlow, postChannelFlow, removeChannelFlow } from "./api/channels/flows/route.js";
import { getMetaOAuthStartUrl, handleMetaOAuthCallback } from "./api/channels/oauth-route.js";
import {
  getCustomerSupportInboxSessionRoute,
  getCustomerSupportInboxSessionsRoute,
  patchCustomerSupportInboxSessionRoute,
  postCustomerSupportInboxReplyRoute,
} from "./api/channels/customer-support-inbox-route.js";
import { postChannelJob, postCompleteChannelJob, postExecuteChannelJob, postRetryChannelJob } from "./api/channels/jobs/route.js";
import {
  getCustomerSupportWidgetConfigRoute,
  getCustomerSupportWidgetSessionRoute,
  postCustomerSupportWidgetHandoffRoute,
  postCustomerSupportWidgetMessageRoute,
  postCustomerSupportWidgetSessionRoute,
} from "./api/channels/customer-support-widget-route.js";
import { handleStatusWebhook } from "./api/webhooks/twilio/status/route.js";
import { buildTwiML } from "./api/webhooks/twilio/twiml/route.js";
import { handleGather } from "./api/webhooks/twilio/twiml/gather/route.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "./modules/shared/errors.js";
import { createServiceSupabaseClient } from "./modules/shared/supabase-client.js";
import { listCallAgents, listCallFlows, listCallJobs } from "./modules/voice/services.js";
import { listChannelAccounts, listChannelAgents, listChannelFlows, listChannelJobs } from "./modules/channels/services.js";

validateEnv();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/automations", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.get("/health", async (_req, res) => {
  const client = createServiceSupabaseClient();
  if (!client) {
    res.status(503).json({ status: "degraded", error: "Supabase client not configured." });
    return;
  }
  const { error } = await client.from("organizations").select("id").limit(1);
  if (error) {
    res.status(503).json({ status: "degraded", database: "unreachable", error: error.message });
    return;
  }
  res.json({ status: "ok", database: "connected" });
});

// Resolve organizationId from X-Organization-Id header or org_id query param.
async function getOrganizationId(req: express.Request): Promise<string> {
  const id = (req.headers["x-organization-id"] as string) || (req.query.org_id as string);
  return resolveOrganizationId(req.headers.authorization, id);
}

app.get("/me", async (req, res, next) => {
  try {
    const data = await getCurrentUser(req.headers.authorization);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.get("/api/me", async (req, res, next) => {
  try {
    const data = await getCurrentUser(req.headers.authorization);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// --- Pagination helper ---

function parsePagination(query: express.Request["query"]): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset as string) || 0, 0);
  return { limit, offset };
}

function getPublicRequestUrl(req: express.Request) {
  const configuredBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL?.replace(/\/+$/, "");
  const fallbackBaseUrl = `${req.protocol}://${req.get("host") ?? "localhost"}`;
  const baseUrl = configuredBaseUrl || fallbackBaseUrl;
  return `${baseUrl}${req.originalUrl}`;
}

function getSocialOAuthRedirectUri(req: express.Request) {
  const configuredBaseUrl = process.env.SOCIAL_OAUTH_REDIRECT_BASE_URL?.replace(/\/+$/, "");
  const fallbackBaseUrl = `${req.protocol}://${req.get("host") ?? "localhost"}`;
  const baseUrl = configuredBaseUrl || fallbackBaseUrl;
  return `${baseUrl}/api/channels/oauth/meta/callback`;
}

// --- Voice API ---

app.get("/api/voice", async (req, res, next) => {
  try {
    const data = await getVoiceSnapshot(await getOrganizationId(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/voice/agents", async (req, res, next) => {
  try {
    const data = await postCallAgent(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/voice/flows", async (req, res, next) => {
  try {
    const data = await postCallFlow(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.get("/api/channels", async (req, res, next) => {
  try {
    const data = await getChannelsSnapshot(await getOrganizationId(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/accounts", async (req, res, next) => {
  try {
    const data = await postChannelAccount(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/agents", async (req, res, next) => {
  try {
    const data = await postChannelAgent(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/flows", async (req, res, next) => {
  try {
    const data = await postChannelFlow(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/jobs", async (req, res, next) => {
  try {
    const data = await postChannelJob(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/channels/accounts/:accountId", async (req, res, next) => {
  try {
    const data = await patchChannelAccount(await getOrganizationId(req), req.params.accountId, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/channels/accounts/:accountId", async (req, res, next) => {
  try {
    const data = await removeChannelAccount(await getOrganizationId(req), req.params.accountId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/channels/agents/:agentId", async (req, res, next) => {
  try {
    const data = await patchChannelAgent(await getOrganizationId(req), req.params.agentId, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/channels/agents/:agentId", async (req, res, next) => {
  try {
    const data = await removeChannelAgent(await getOrganizationId(req), req.params.agentId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/channels/flows/:flowId", async (req, res, next) => {
  try {
    const data = await patchChannelFlow(await getOrganizationId(req), req.params.flowId, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/channels/flows/:flowId", async (req, res, next) => {
  try {
    const data = await removeChannelFlow(await getOrganizationId(req), req.params.flowId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/jobs/:jobId/execute", async (req, res, next) => {
  try {
    const data = await postExecuteChannelJob(await getOrganizationId(req), req.params.jobId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/jobs/:jobId/retry", async (req, res, next) => {
  try {
    const data = await postRetryChannelJob(await getOrganizationId(req), req.params.jobId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/channels/jobs/:jobId/complete", async (req, res, next) => {
  try {
    const data = await postCompleteChannelJob(await getOrganizationId(req), req.params.jobId, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
app.post("/api/voice/jobs", async (req, res, next) => {
  try {
    const data = await postCallJob(await getOrganizationId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// --- Voice list endpoints ---

app.get("/api/voice/agents", async (req, res, next) => {
  try {
    const data = await listCallAgents(await getOrganizationId(req), parsePagination(req.query));
    res.json({ data, limit: parsePagination(req.query).limit, offset: parsePagination(req.query).offset });
  } catch (err) { next(err); }
});

app.get("/api/voice/flows", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listCallFlows(await getOrganizationId(req), pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

app.get("/api/voice/jobs", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listCallJobs(await getOrganizationId(req), pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

// --- Channels list endpoints ---

app.get("/api/channels/accounts", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listChannelAccounts(await getOrganizationId(req), undefined, pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

app.get("/api/channels/agents", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listChannelAgents(await getOrganizationId(req), undefined, pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

app.get("/api/channels/flows", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listChannelFlows(await getOrganizationId(req), undefined, pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

app.get("/api/channels/jobs", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await listChannelJobs(await getOrganizationId(req), undefined, pg);
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

// --- Social account OAuth ---

app.get("/api/channels/oauth/meta/start", async (req, res, next) => {
  try {
    if (typeof req.query.channel !== "string") throw new ValidationError("channel is required.");
    const redirectUrl = getMetaOAuthStartUrl({
      channel: req.query.channel,
      organizationId: await getOrganizationId(req),
      redirectUri: getSocialOAuthRedirectUri(req),
    });
    res.redirect(302, redirectUrl);
  } catch (err) { next(err); }
});

app.get("/api/channels/oauth/meta/callback", async (req, res, next) => {
  try {
    if (typeof req.query.error === "string") {
      throw new ValidationError(req.query.error_description as string || req.query.error);
    }
    if (typeof req.query.code !== "string" || typeof req.query.state !== "string") {
      throw new ValidationError("OAuth callback is missing code or state.");
    }
    const account = await handleMetaOAuthCallback({
      code: req.query.code,
      state: req.query.state,
      redirectUri: getSocialOAuthRedirectUri(req),
    });
    res.redirect(303, `/automations?connected=${encodeURIComponent(account.channel)}&account=${encodeURIComponent(account.id)}`);
  } catch (err) { next(err); }
});

// --- Customer support inbox API ---

app.get("/api/customer-support/inbox/sessions", async (req, res, next) => {
  try {
    const pg = parsePagination(req.query);
    const data = await getCustomerSupportInboxSessionsRoute(await getOrganizationId(req), {
      accountId: typeof req.query.account_id === "string" ? req.query.account_id : undefined,
      limit: pg.limit,
      offset: pg.offset,
    });
    res.json({ data, limit: pg.limit, offset: pg.offset });
  } catch (err) { next(err); }
});

app.get("/api/customer-support/inbox/sessions/:sessionId", async (req, res, next) => {
  try {
    const data = await getCustomerSupportInboxSessionRoute(await getOrganizationId(req), req.params.sessionId);
    res.json(data);
  } catch (err) { next(err); }
});

app.post("/api/customer-support/inbox/sessions/:sessionId/messages", async (req, res, next) => {
  try {
    const data = await postCustomerSupportInboxReplyRoute(await getOrganizationId(req), req.params.sessionId, req.body);
    res.json(data);
  } catch (err) { next(err); }
});

app.patch("/api/customer-support/inbox/sessions/:sessionId", async (req, res, next) => {
  try {
    const data = await patchCustomerSupportInboxSessionRoute(await getOrganizationId(req), req.params.sessionId, req.body);
    res.json(data);
  } catch (err) { next(err); }
});

// --- Customer support widget API ---

app.get("/api/customer-support/widget/config/:publicWidgetKey", async (req, res, next) => {
  try {
    const data = await getCustomerSupportWidgetConfigRoute(
      req.params.publicWidgetKey,
      req.get("origin") ?? undefined,
      typeof req.query.source_url === "string" ? req.query.source_url : undefined
    );
    res.json(data);
  } catch (err) { next(err); }
});

app.post("/api/customer-support/widget/sessions", async (req, res, next) => {
  try {
    const data = await postCustomerSupportWidgetSessionRoute({
      ...req.body,
      origin: req.body?.origin ?? req.get("origin") ?? undefined,
    });
    res.status(201).json(data);
  } catch (err) { next(err); }
});

app.get("/api/customer-support/widget/sessions/:sessionId", async (req, res, next) => {
  try {
    const data = await getCustomerSupportWidgetSessionRoute(req.params.sessionId, req.get("origin") ?? undefined);
    res.json(data);
  } catch (err) { next(err); }
});

app.post("/api/customer-support/widget/sessions/:sessionId/messages", async (req, res, next) => {
  try {
    const data = await postCustomerSupportWidgetMessageRoute(req.params.sessionId, {
      ...req.body,
      origin: req.body?.origin ?? req.get("origin") ?? undefined,
    });
    res.json(data);
  } catch (err) { next(err); }
});

app.post("/api/customer-support/widget/sessions/:sessionId/handoff", async (req, res, next) => {
  try {
    const data = await postCustomerSupportWidgetHandoffRoute(req.params.sessionId, {
      ...req.body,
      origin: req.body?.origin ?? req.get("origin") ?? undefined,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// --- Twilio Webhooks ---

app.post("/api/webhooks/twilio/voice/twiml", async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string;
    const gatherUrl = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/webhooks/twilio/voice/twiml/gather?jobId=${jobId}`;
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    const twiml = await buildTwiML(jobId, gatherUrl, getPublicRequestUrl(req), req.body, signature);
    res.set("Content-Type", "text/xml").send(twiml);
  } catch (err) {
    next(err);
  }
});

app.post("/api/webhooks/twilio/voice/twiml/gather", async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string;
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    const twiml = await handleGather(jobId, getPublicRequestUrl(req), req.body, signature);
    res.set("Content-Type", "text/xml").send(twiml);
  } catch (err) {
    next(err);
  }
});

app.post("/api/webhooks/twilio/voice/status", async (req, res, next) => {
  try {
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    await handleStatusWebhook(getPublicRequestUrl(req), req.body, signature);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

// --- Error handler ---

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ValidationError) return void res.status(400).json({ error: err.message });
  if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
  if (err instanceof UnauthorizedError) return void res.status(401).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT ?? 3005;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});




