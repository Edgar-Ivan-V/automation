import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getCurrentUser, resolveOrganizationId } from "./api/me/route.js";
import { getVoiceSnapshot } from "./api/voice/route.js";
import { getChannelsSnapshot } from "./api/channels/route.js";
import { postCallAgent } from "./api/voice/agents/route.js";
import { postCallFlow } from "./api/voice/flows/route.js";
import { postCallJob } from "./api/voice/jobs/route.js";
import { patchChannelAccount, postChannelAccount, removeChannelAccount } from "./api/channels/accounts/route.js";
import { patchChannelAgent, postChannelAgent, removeChannelAgent } from "./api/channels/agents/route.js";
import { patchChannelFlow, postChannelFlow, removeChannelFlow } from "./api/channels/flows/route.js";
import { postChannelJob, postCompleteChannelJob, postExecuteChannelJob, postRetryChannelJob } from "./api/channels/jobs/route.js";
import { handleStatusWebhook } from "./api/webhooks/twilio/status/route.js";
import { buildTwiML } from "./api/webhooks/twilio/twiml/route.js";
import { handleGather } from "./api/webhooks/twilio/twiml/gather/route.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "./modules/shared/errors.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/automations", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
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

// --- Twilio Webhooks ---

app.post("/api/webhooks/twilio/voice/twiml", async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string;
    const gatherUrl = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/webhooks/twilio/voice/twiml/gather?jobId=${jobId}`;
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    const twiml = await buildTwiML(jobId, gatherUrl, req.url, req.body, signature);
    res.set("Content-Type", "text/xml").send(twiml);
  } catch (err) {
    next(err);
  }
});

app.post("/api/webhooks/twilio/voice/twiml/gather", async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string;
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    const twiml = await handleGather(jobId, req.url, req.body, signature);
    res.set("Content-Type", "text/xml").send(twiml);
  } catch (err) {
    next(err);
  }
});

app.post("/api/webhooks/twilio/voice/status", async (req, res, next) => {
  try {
    const signature = (req.headers["x-twilio-signature"] as string) ?? null;
    await handleStatusWebhook(req.url, req.body, signature);
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});




