/**
 * FILE: src/modules/channels/services.ts
 *
 * Lógica de negocio del módulo de canales omnicanal. Orquesta repositorios
 * y conectores para implementar el CRUD de entidades y la ejecución de jobs.
 *
 * Flujo de ejecución de un job:
 *   1. createChannelJob() → valida entidades, crea job con status "queued"
 *   2. executeChannelJob() → busca un conector registrado para el canal
 *      - Si hay conector: llama connector.execute(job, flow) → resultado real
 *      - Si no hay conector: buildExecutionPreview() → modo preview/simulado
 *      - Actualiza el job a "completed" con outcome y resultPayload
 *   3. retryChannelJob() → resetea el job a "queued" y lo re-ejecuta
 *   4. markChannelJobCompleted() → marca manualmente como completado
 *
 * Validaciones:
 *   - Account, agent y flow deben pertenecer al mismo canal y organización
 *   - Los canales se validan contra el catálogo (isSupportedChannel)
 *   - Los estados se validan contra sets de valores permitidos
 *
 * Exports principales:
 *   - CRUD de accounts, agents, flows, jobs (create, update, delete, list)
 *   - executeChannelJob / retryChannelJob / markChannelJobCompleted
 *   - getChannelAutomationSnapshot: todos los datos para el dashboard
 */

import { getChannelConnector } from "./connectors.js";
import {
  createAppointmentFromChannelToolRepository,
  createChannelAccountRepository,
  createChannelAgentRepository,
  createChannelFlowRepository,
  createChannelJobEventRepository,
  createChannelJobRepository,
  createCustomerSupportMessageRepository,
  createCustomerSupportSessionRepository,
  deleteChannelAccountRepository,
  deleteChannelAgentRepository,
  deleteChannelFlowRepository,
  getChannelAccountRepository,
  getChannelAgentRepository,
  getChannelFlowRepository,
  getChannelJobRepository,
  getCustomerSupportAccountByWidgetKeyRepository,
  getCustomerSupportSessionRepository,
  listChannelAccountsRepository,
  listChannelAgentsRepository,
  listChannelFlowsRepository,
  listChannelJobsRepository,
  listCustomerSupportSessionsRepository,
  listCustomerSupportMessagesRepository,
  updateCustomerSupportSessionRepository,
  updateChannelAccountRepository,
  updateChannelAgentRepository,
  updateChannelFlowRepository,
  updateChannelJobRepository
} from "./repositories.js";
import {
  CHANNEL_ACTIONS,
  CHANNEL_TRIGGERS,
  getChannelAgentTypes,
  isSupportedChannel,
} from "./catalog.js";
import { requireServiceSupabaseClient } from "../shared/supabase-client.js";
import { NotFoundError, ValidationError } from "../shared/errors.js";
import { optionalString, requireNonEmptyString } from "../shared/validation.js";
import type {
  ChannelAccount,
  ChannelAgentType,
  ChannelAccountStatus,
  ChannelBotStatus,
  ChannelFlow,
  ChannelJob,
  ChannelJobOutcome,
  ChannelJobStatus,
  ChannelKind,
  CreateCustomerSupportWidgetSessionInput,
  CustomerSupportMessage,
  CustomerSupportMessageType,
  CustomerSupportSession,
  CustomerSupportSessionStatus,
  ChannelSummary,
  ChannelSummarySection,
  CompleteChannelJobInput,
  CreateChannelAccountInput,
  CreateChannelAgentInput,
  CreateChannelFlowInput,
  CreateChannelJobInput,
  ListCustomerSupportInboxSessionsInput,
  RequestCustomerSupportHandoffInput,
  SendCustomerSupportInboxReplyInput,
  SendCustomerSupportWidgetMessageInput,
  UpdateCustomerSupportInboxSessionInput,
  UpdateChannelAccountInput,
  UpdateChannelAgentInput,
  UpdateChannelFlowInput
} from "./types.js";

const accountStatuses = new Set<ChannelAccountStatus>(["draft", "connected", "disconnected", "error"]);
const botStatuses = new Set<ChannelBotStatus>(["draft", "active", "paused"]);
const jobStatuses = new Set<ChannelJobStatus>(["draft", "queued", "scheduled", "running", "completed", "failed", "canceled", "requires_auth"]);
const customerSupportSessionStatuses = new Set<CustomerSupportSessionStatus>(["active", "handoff_requested", "resolved", "closed"]);

function normalizeStoredChannel(value: unknown): ChannelKind {
  if (value === "automations") return "customer_support";
  if (typeof value !== "string" || !isSupportedChannel(value)) {
    throw new ValidationError("channel is invalid.");
  }
  return value;
}

function parseChannel(value: unknown, field = "channel"): ChannelKind {
  const channel = requireNonEmptyString(value, field);
  if (channel === "automations") return "customer_support";
  if (!isSupportedChannel(channel)) throw new ValidationError(`${field} is invalid.`);
  return channel as ChannelKind;
}

function parseAccountStatus(value: unknown) {
  if (value == null || value === "") return "connected" as const;
  if (typeof value !== "string" || !accountStatuses.has(value as ChannelAccountStatus)) {
    throw new ValidationError("status must be one of draft, connected, disconnected, error.");
  }
  return value as ChannelAccountStatus;
}

function parseBotStatus(value: unknown) {
  if (value == null || value === "") return "draft" as const;
  if (typeof value !== "string" || !botStatuses.has(value as ChannelBotStatus)) {
    throw new ValidationError("status must be one of draft, active, paused.");
  }
  return value as ChannelBotStatus;
}

function parseJobStatus(value: unknown) {
  if (value == null || value === "") return "queued" as const;
  if (typeof value !== "string" || !jobStatuses.has(value as ChannelJobStatus)) {
    throw new ValidationError("status must be one of draft, queued, scheduled, running, completed, failed, canceled, requires_auth.");
  }
  return value as ChannelJobStatus;
}

function parseCustomerSupportSessionStatus(value: unknown) {
  if (typeof value !== "string" || !customerSupportSessionStatuses.has(value as CustomerSupportSessionStatus)) {
    throw new ValidationError("status must be one of active, handoff_requested, resolved, closed.");
  }
  return value as CustomerSupportSessionStatus;
}

function requireRecord(value: unknown, field: string) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function optionalArrayOfStrings(value: unknown, field: string) {
  if (value == null) return [] as string[];
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array of strings.`);
  return value
    .map((item) => {
      if (typeof item !== "string") throw new ValidationError(`${field} must be an array of strings.`);
      return item.trim();
    })
    .filter(Boolean);
}

function normalizeOriginValue(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildDefaultOriginFromHandle(handle: string | null | undefined) {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return normalizeOriginValue(candidate);
}

function mergeUniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

function buildCustomerSupportMetadata(name: string, handle: string | null, rawMetadata: unknown, existingMetadata?: Record<string, unknown> | null) {
  const inputMetadata = requireRecord(rawMetadata, "metadata");
  const currentMetadata = existingMetadata ?? {};
  const existingWidget = requireRecord(currentMetadata.widget, "metadata.widget");
  const inputWidget = requireRecord(inputMetadata.widget, "metadata.widget");
  const defaultOrigin = buildDefaultOriginFromHandle(handle);
  const allowedOrigins = mergeUniqueStrings([
    ...optionalArrayOfStrings(currentMetadata.allowedOrigins, "metadata.allowedOrigins"),
    ...optionalArrayOfStrings(inputMetadata.allowedOrigins, "metadata.allowedOrigins"),
    defaultOrigin,
  ]);

  return {
    ...currentMetadata,
    ...inputMetadata,
    publicWidgetKey:
      optionalString(inputMetadata.publicWidgetKey, "metadata.publicWidgetKey")
      ?? optionalString(currentMetadata.publicWidgetKey, "metadata.publicWidgetKey")
      ?? `csw_${crypto.randomUUID().replace(/-/g, "")}`,
    allowedOrigins,
    widget: {
      title:
        optionalString(inputWidget.title, "metadata.widget.title")
        ?? optionalString(existingWidget.title, "metadata.widget.title")
        ?? name,
      greeting:
        optionalString(inputWidget.greeting, "metadata.widget.greeting")
        ?? optionalString(existingWidget.greeting, "metadata.widget.greeting")
        ?? "Hola, soy el asistente del sitio. Cuéntame qué necesitas y te ayudo desde aquí.",
      agentLabel:
        optionalString(inputWidget.agentLabel, "metadata.widget.agentLabel")
        ?? optionalString(existingWidget.agentLabel, "metadata.widget.agentLabel")
        ?? "Asistente web",
      accentColor:
        optionalString(inputWidget.accentColor, "metadata.widget.accentColor")
        ?? optionalString(existingWidget.accentColor, "metadata.widget.accentColor")
        ?? "#2563eb",
    },
    support: {
      ...(requireRecord(currentMetadata.support, "metadata.support")),
      ...(requireRecord(inputMetadata.support, "metadata.support")),
    },
  } satisfies Record<string, unknown>;
}

function parseEnumValue(value: unknown, allowedValues: string[], field: string, defaultValue: string) {
  if (value == null || value === "") return defaultValue;
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new ValidationError(`${field} is invalid.`);
  }
  return value;
}

function parseChannelAction(channel: ChannelKind, value: unknown) {
  const actionType = requireNonEmptyString(value, "actionType");
  if (!CHANNEL_ACTIONS[channel].some((action) => action.action_type === actionType)) {
    throw new ValidationError("actionType is invalid for this channel.");
  }
  return actionType;
}

function parseChannelTrigger(channel: ChannelKind, value: unknown) {
  const triggerType = requireNonEmptyString(value, "triggerType");
  if (!CHANNEL_TRIGGERS[channel].some((trigger) => trigger.trigger_type === triggerType)) {
    throw new ValidationError("triggerType is invalid for this channel.");
  }
  return triggerType;
}

function normalizeChannelAgentConfig(channel: ChannelKind, rawConfig: unknown, rawAgentType: unknown) {
  const config = requireRecord(rawConfig, "config");
  const definitions = getChannelAgentTypes(channel);
  const allowedTypes = definitions.map((definition) => definition.agent_type);
  const fallbackType = allowedTypes[0] ?? "publisher";
  const agentType = parseEnumValue(rawAgentType ?? config.agentType, allowedTypes, "agentType", fallbackType) as ChannelAgentType;
  const definition = definitions.find((item) => item.agent_type === agentType);
  if (!definition) throw new ValidationError("agentType is invalid for this channel.");

  const normalizedConfig: Record<string, unknown> = { agentType };
  for (const field of definition.config_fields) {
    normalizedConfig[field.key] = parseEnumValue(
      config[field.key],
      field.options.map((option) => option.value),
      `config.${field.key}`,
      field.options[0]?.value ?? ""
    );
  }
  normalizedConfig.llmProvider = "openrouter";
  normalizedConfig.llmModel = optionalString(config.llmModel, "config.llmModel") ?? process.env.OPENROUTER_MODEL?.trim() ?? "openai/gpt-4.1-mini";
  normalizedConfig.tools = optionalArrayOfStrings(config.tools, "config.tools");
  normalizedConfig.toolInstructions = optionalString(config.toolInstructions, "config.toolInstructions") ?? "";

  return normalizedConfig;
}

function getAgentTypeFromConfig(config: Record<string, unknown> | null | undefined) {
  return typeof config?.agentType === "string" ? config.agentType : null;
}

function ensureActionAllowedForAgent(channel: ChannelKind, agentConfig: Record<string, unknown> | null | undefined, actionType: string) {
  const agentType = getAgentTypeFromConfig(agentConfig);
  if (!agentType) return;
  const definition = getChannelAgentTypes(channel).find((item) => item.agent_type === agentType);
  if (!definition) return;
  if (!definition.allowed_action_types.includes(actionType)) {
    throw new ValidationError("Selected agent type cannot run this action.");
  }
}

function getCustomerSupportAllowedOrigins(metadata: Record<string, unknown>) {
  return mergeUniqueStrings(optionalArrayOfStrings(metadata.allowedOrigins, "metadata.allowedOrigins").map((value) => normalizeOriginValue(value) ?? value));
}

function assertCustomerSupportOrigin(metadata: Record<string, unknown>, origin: string | null, sourceUrl?: string | null) {
  const allowedOrigins = getCustomerSupportAllowedOrigins(metadata);
  if (!allowedOrigins.length) return;
  const normalizedOrigin = normalizeOriginValue(origin) ?? normalizeOriginValue(sourceUrl ?? null);
  if (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin)) {
    throw new ValidationError("Origin is not allowed for this customer support widget.");
  }
}

function getCustomerSupportWidgetSettings(account: ChannelAccount) {
  const metadata = requireRecord(account.metadata, "metadata");
  const widget = requireRecord(metadata.widget, "metadata.widget");
  return {
    publicWidgetKey: optionalString(metadata.publicWidgetKey, "metadata.publicWidgetKey"),
    allowedOrigins: getCustomerSupportAllowedOrigins(metadata),
    title: optionalString(widget.title, "metadata.widget.title") ?? account.name,
    greeting: optionalString(widget.greeting, "metadata.widget.greeting") ?? "Hola, soy el asistente del sitio. Cuéntame qué necesitas y te ayudo desde aquí.",
    agentLabel: optionalString(widget.agentLabel, "metadata.widget.agentLabel") ?? "Asistente web",
    accentColor: optionalString(widget.accentColor, "metadata.widget.accentColor") ?? "#2563eb",
  };
}

function chooseCustomerSupportAction(text: string) {
  const normalizedText = text.toLowerCase();
  if (/(humano|asesor|persona|agente|representante|llamarme|speak to someone)/i.test(normalizedText)) return "handoff_agent";
  if (/(agenda|agendar|cita|reservar|reserva|demo|reuni[oÃ³]n|meeting|appointment|book)/i.test(normalizedText)) return "schedule_appointment";
  if (/(ticket|bug|error|falla|fallo|problema|reembolso|refund|factura|billing|cancelaci[oó]n|cancel)/i.test(normalizedText)) return "capture_ticket";
  if (/(precio|pricing|horario|hours|documentaci[oó]n|docs|faq|ayuda|help|como|cómo|integraci[oó]n|env[ií]o|shipping)/i.test(normalizedText)) return "suggest_article";
  return "answer_chat";
}

function buildCustomerSupportArticle(text: string, account: ChannelAccount) {
  const normalizedText = text.toLowerCase();
  const baseUrl = buildDefaultOriginFromHandle(account.handle) ?? "https://support.example.com";
  if (/(factura|billing|reembolso|refund)/i.test(normalizedText)) {
    return { title: "Facturación y reembolsos", slug: "billing-refunds" };
  }
  if (/(env[ií]o|shipping|entrega)/i.test(normalizedText)) {
    return { title: "Seguimiento de envíos", slug: "shipping-tracking" };
  }
  if (/(integraci[oó]n|api|webhook|sdk|instalaci[oó]n)/i.test(normalizedText)) {
    return { title: "Integración e instalación", slug: "integration-setup" };
  }
  return { title: "Centro de ayuda general", slug: "help-center" };
}

function buildCustomerSupportTicketId() {
  return `SUP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function summarizeCustomerSupportSession(messages: CustomerSupportMessage[]) {
  const visitorMessages = messages.filter((message) => message.role === "visitor" && message.content).slice(-3);
  if (!visitorMessages.length) return null;
  return visitorMessages.map((message) => message.content).join(" | ").slice(0, 280);
}

function optionalDateString(value: unknown, field: string) {
  const input = optionalString(value, field);
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid date.`);
  }
  return parsed.toISOString();
}

function parseDurationMinutes(value: unknown, defaultValue = 30) {
  if (value == null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.round(parsed), 15), 240);
}

function readToolString(payload: Record<string, unknown>, actionConfig: Record<string, unknown>, keys: string[], field: string) {
  for (const key of keys) {
    const value = optionalString(payload[key] ?? actionConfig[key], field);
    if (value) return value;
  }
  return null;
}

async function executeScheduleAppointmentTool(
  client: ReturnType<typeof requireServiceSupabaseClient>,
  organizationId: string,
  job: ChannelJob,
  flow: ChannelFlow
) {
  const payload = requireRecord(job.payload, "job.payload");
  const actionConfig = requireRecord(flow.action_config, "flow.action_config");
  const defaultStartsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const startsAt =
    optionalDateString(payload.appointmentStartsAt ?? payload.startsAt ?? actionConfig.appointmentStartsAt ?? actionConfig.startsAt, "appointmentStartsAt")
    ?? defaultStartsAt;
  const durationMinutes = parseDurationMinutes(payload.appointmentDurationMinutes ?? payload.durationMinutes ?? actionConfig.appointmentDurationMinutes ?? actionConfig.durationMinutes);
  const startsAtDate = new Date(startsAt);
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60 * 1000).toISOString();
  const appointmentTitle =
    readToolString(payload, actionConfig, ["appointmentTitle", "title", "targetRef"], "appointmentTitle")
    ?? job.target_ref
    ?? job.title
    ?? "Cita agendada por agente";
  const location = readToolString(payload, actionConfig, ["appointmentLocation", "location"], "appointmentLocation");
  const prompt = readToolString(payload, actionConfig, ["prompt", "instructions", "notes"], "appointmentNotes");
  const notes = [
    prompt,
    job.target_ref ? `Referencia: ${job.target_ref}` : null,
    `Origen: ${job.channel}/${flow.action_type}`,
    `Job: ${job.id}`,
  ].filter(Boolean).join("\n");

  const appointment = await createAppointmentFromChannelToolRepository(client, {
    organization_id: organizationId,
    contact_id: job.contact_id,
    title: appointmentTitle,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "scheduled",
    location,
    notes: notes || null,
  });

  return {
    outcome: "scheduled" as ChannelJobOutcome,
    summary: `Cita agendada en modo prueba para ${startsAtDate.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}.`,
    resultPayload: {
      mode: "internal_tool",
      tool: "schedule_appointment",
      channel: job.channel,
      actionType: flow.action_type,
      appointment,
      source: {
        jobId: job.id,
        flowId: flow.id,
        accountId: job.account_id,
        agentId: job.agent_id,
        targetRef: job.target_ref,
      },
      input: payload,
    },
    isPreview: false,
  };
}

function buildPreviewResultPayload(channel: ChannelKind, actionType: string, job: { title: string; target_ref: string | null; payload: Record<string, unknown> }) {
  const base = {
    mode: "preview",
    channel,
    actionType,
    title: job.title,
    targetRef: job.target_ref,
    input: job.payload,
  } satisfies Record<string, unknown>;

  switch (channel) {
    case "customer_support":
      if (actionType === "answer_chat") {
        return {
          ...base,
          conversation: { lane: "website_chat", status: "answered_preview", handoffRecommended: false },
          visitor: { source: "website_widget", sessionStatus: "active" },
          metrics: { firstResponseSeconds: 18, repliesSent: 1, satisfactionScore: 89 },
        };
      }
      if (actionType === "suggest_article") {
        return {
          ...base,
          knowledge: { articleStatus: "suggested_preview", articlesSuggested: 1 },
          conversation: { lane: "website_chat", status: "article_shared_preview" },
          metrics: { clicks: 1, articleViews: 1, deflectionRate: 63 },
        };
      }
      if (actionType === "capture_ticket") {
        return {
          ...base,
          ticket: { status: "created_preview", priority: "normal", queue: "support" },
          metrics: { ticketsCreated: 1, slaHours: 4 },
        };
      }
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "website_chat", status: "media_sent_preview" },
          metrics: { views: 1, clicks: 2, repliesSent: 1 },
        };
      }
      if (actionType === "handoff_agent") {
        return {
          ...base,
          conversation: { lane: "website_chat", status: "escalated_preview" },
          metrics: { handoffs: 1, waitMinutes: 3 },
        };
      }
      break;
    case "instagram":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "instagram_dm", status: "media_sent_preview", handoffRecommended: false },
          metrics: { views: 180, taps: 24, repliesSent: 1 },
        };
      }
      if (actionType === "publish_post") {
        return {
          ...base,
          asset: { format: "image", status: "draft_preview", uploadedAssets: 1 },
          metrics: { reach: 420, likes: 37, comments: 6, saves: 9, shares: 4, leads: 2 },
        };
      }
      if (actionType === "publish_story") {
        return {
          ...base,
          asset: { format: "story", status: "draft_preview", uploadedAssets: 1 },
          metrics: { impressions: 310, tapsForward: 54, tapsBack: 18, replies: 5 },
        };
      }
      if (actionType === "publish_reel") {
        return {
          ...base,
          asset: { format: "reel", status: "draft_preview", uploadedAssets: 1 },
          metrics: { plays: 1200, completionRate: 41, shares: 18, saves: 13, leads: 3 },
        };
      }
      if (actionType === "reply_dm") {
        return {
          ...base,
          conversation: { lane: "instagram_dm", status: "replied_preview", handoffRecommended: false },
          metrics: { firstResponseMinutes: 8, repliesSent: 1 },
        };
      }
      if (actionType === "manage_ad_campaign") {
        return {
          ...base,
          campaign: { status: "draft_preview", goal: "leads", platform: "instagram" },
          metrics: { budgetDaily: 35, clickThroughRate: 2.7, leads: 5 },
        };
      }
      break;
    case "tiktok":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "creator_outreach", status: "media_sent_preview" },
          metrics: { views: 260, repliesSent: 1, clicks: 7 },
        };
      }
      if (actionType === "publish_video") {
        return {
          ...base,
          asset: { format: "video", status: "draft_preview", uploadedVideos: 1 },
          metrics: { views: 2300, completionRate: 34, likes: 120, comments: 19, shares: 22, leads: 4 },
        };
      }
      if (actionType === "reply_comment") {
        return {
          ...base,
          conversation: { lane: "comment", status: "replied_preview" },
          metrics: { commentsHandled: 1, conversionPotential: 61 },
        };
      }
      if (actionType === "capture_lead") {
        return {
          ...base,
          lead: { status: "captured_preview", source: "video_comment" },
          metrics: { qualificationScore: 72 },
        };
      }
      if (actionType === "manage_ad_campaign") {
        return {
          ...base,
          campaign: { status: "draft_preview", goal: "traffic", platform: "tiktok" },
          metrics: { budgetDaily: 42, clickThroughRate: 1.9, leads: 3 },
        };
      }
      break;
    case "email":
      if (actionType === "send_media") {
        return {
          ...base,
          delivery: { status: "queued_preview", campaignType: "media_email", attachments: 1 },
          asset: { format: "media", status: "attached_preview", uploadedAssets: 1 },
          metrics: { delivered: 1, openRate: 43, clickRate: 11, attachmentDownloads: 3 },
        };
      }
      if (actionType === "send_email") {
        return {
          ...base,
          delivery: { status: "queued_preview", campaignType: "single_email" },
          metrics: { delivered: 1, openRate: 46, clickRate: 9, replyRate: 6 },
        };
      }
      if (actionType === "send_sequence") {
        return {
          ...base,
          delivery: { status: "queued_preview", campaignType: "sequence", steps: 3 },
          metrics: { enrolledContacts: 24, activeStep: 1, expectedReplyRate: 12 },
        };
      }
      if (actionType === "tag_contact") {
        return {
          ...base,
          segmentation: { status: "tagged_preview", tagsApplied: ["interested", "follow_up"] },
          metrics: { taggedContacts: 1 },
        };
      }
      break;
    case "facebook":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "dm", status: "media_sent_preview" },
          metrics: { views: 210, repliesSent: 1, clicks: 9 },
        };
      }
      if (actionType === "publish_post") {
        return {
          ...base,
          asset: { format: "post", status: "draft_preview", publishedPosts: 1 },
          metrics: { reach: 510, reactions: 42, comments: 11, leads: 2 },
        };
      }
      if (actionType === "reply_comment") {
        return {
          ...base,
          conversation: { lane: "comment", status: "replied_preview" },
          metrics: { commentsHandled: 1, responseMinutes: 12 },
        };
      }
      if (actionType === "reply_dm") {
        return {
          ...base,
          conversation: { lane: "dm", status: "replied_preview", handoffRecommended: false },
          metrics: { repliesSent: 1, openThreads: 3 },
        };
      }
      if (actionType === "capture_lead") {
        return {
          ...base,
          lead: { status: "captured_preview", source: "facebook_interaction" },
          metrics: { qualificationScore: 68 },
        };
      }
      if (actionType === "manage_ad_campaign") {
        return {
          ...base,
          campaign: { status: "draft_preview", goal: "engagement", platform: "facebook" },
          metrics: { budgetDaily: 28, clickThroughRate: 1.6, leads: 2 },
        };
      }
      break;
    case "x":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "dm", status: "media_sent_preview" },
          metrics: { impressions: 190, engagements: 16, replies: 1 },
        };
      }
      if (actionType === "manage_ad_campaign") {
        return {
          ...base,
          campaign: { status: "draft_preview", goal: "traffic", platform: "x" },
          metrics: { budgetDaily: 25, clickThroughRate: 1.4, leads: 1 },
        };
      }
      return {
        ...base,
        conversation: { lane: actionType === "send_dm" ? "dm" : "public", status: "executed_preview" },
        metrics: { impressions: 340, engagements: 28, replies: actionType === "reply_mention" ? 1 : 0 },
      };
    case "whatsapp":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "inbox", status: "media_sent_preview" },
          metrics: { delivered: 1, views: 1, resolvedChats: 1 },
        };
      }
      if (actionType === "send_template") {
        return {
          ...base,
          conversation: { lane: "template", status: "queued_preview" },
          metrics: { delivered: 1, replyRate: 24, handoffRate: 7 },
        };
      }
      if (actionType === "reply_message") {
        return {
          ...base,
          conversation: { lane: "inbox", status: "replied_preview" },
          metrics: { firstResponseMinutes: 4, resolvedChats: 1 },
        };
      }
      if (actionType === "handoff_agent") {
        return {
          ...base,
          conversation: { lane: "handoff", status: "escalated_preview" },
          metrics: { handoffs: 1, waitMinutes: 2 },
        };
      }
      break;
    case "messenger":
      if (actionType === "send_media") {
        return {
          ...base,
          asset: { format: "media", status: "sent_preview", uploadedAssets: 1 },
          conversation: { lane: "inbox", status: "media_sent_preview" },
          metrics: { repliesSent: 1, openThreads: 2, mediaViews: 1 },
        };
      }
      return {
        ...base,
        conversation: { lane: actionType === "reply_comment" ? "comment" : "inbox", status: "executed_preview" },
        metrics: { repliesSent: 1, openThreads: 2, handoffs: actionType === "handoff_agent" ? 1 : 0 },
      };
  }

  return base;
}

function buildExecutionPreview(actionType: string) {
  if (actionType.startsWith("publish")) return { outcome: "published", summary: "Preview generated locally. Connect the platform provider to publish for real." } as const;
  if (actionType.startsWith("upload")) return { outcome: "published", summary: "Preview generated locally. Connect the platform provider to upload for real." } as const;
  if (actionType.startsWith("send")) return { outcome: "sent", summary: "Preview generated locally. Connect the provider to deliver the message for real." } as const;
  if (actionType.startsWith("reply")) return { outcome: "replied", summary: "Preview generated locally. Connect the platform inbox provider to reply for real." } as const;
  if (actionType.includes("lead")) return { outcome: "lead_captured", summary: "Lead handling simulated locally. Connect CRM or provider to complete the flow." } as const;
  if (actionType === "answer_chat") return { outcome: "replied", summary: "Preview generated locally. Connect the website chat provider to answer for real." } as const;
  if (actionType === "suggest_article") return { outcome: "sent", summary: "Preview generated locally. Connect the website assistant provider to share knowledge for real." } as const;
  if (actionType === "capture_ticket") return { outcome: "manual_review", summary: "Ticket capture simulated locally. Connect helpdesk or CRM to create the case for real." } as const;
  if (actionType === "handoff_agent") return { outcome: "manual_review", summary: "Handoff simulated locally. Connect the operator inbox to escalate for real." } as const;
  return { outcome: "unknown", summary: "Execution completed in preview mode. External provider is still pending." } as const;
}

function countJobsByAction(jobs: Array<{ flow?: { action_type?: string | null } | null }>, actionType: string) {
  return jobs.filter((job) => job.flow?.action_type === actionType).length;
}

function buildChannelSummary(channel: ChannelKind, input: {
  accounts: ChannelAccount[];
  agents: Array<{ channel: ChannelKind }>;
  flows: Array<ChannelFlow>;
  jobs: Array<{ channel: ChannelKind; status: string; outcome?: string | null; flow?: { action_type?: string | null } | null; result_payload?: Record<string, unknown> | null }>;
}): ChannelSummary {
  const accounts = input.accounts.filter((account) => account.channel === channel);
  const connectedAccountCount = accounts.filter((account) => account.status === "connected").length;
  const agents = input.agents.filter((agent) => agent.channel === channel);
  const flows = input.flows.filter((flow) => flow.channel === channel);
  const jobs = input.jobs.filter((job) => job.channel === channel);
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const runningJobs = jobs.filter((job) => job.status === "running" || job.status === "scheduled" || job.status === "queued").length;
  const blockedJobs = jobs.filter((job) => job.status === "failed" || job.status === "requires_auth" || job.status === "canceled").length;

  const metrics = [
    { key: "connected_accounts", label: "Connected accounts", value: connectedAccountCount, description: "Accounts ready to operate." },
    { key: "agents", label: "Agents", value: agents.length, description: "Reusable agents on this channel." },
    { key: "flows", label: "Flows", value: flows.length, description: "Configured flows for this channel." },
    { key: "jobs", label: "Jobs", value: jobs.length, description: "Recorded executions on this channel." },
  ];

  const executionSection: ChannelSummarySection = {
    key: "execution",
    title: "Execution status",
    description: "High-level operational state for this channel.",
    items: [
      { key: "completed", label: "Completed", value: completedJobs, description: "Finished jobs." },
      { key: "running", label: "Running or queued", value: runningJobs, description: "Jobs still in progress." },
      { key: "blocked", label: "Blocked or failed", value: blockedJobs, description: "Jobs that need attention." },
    ],
  };

  let sections: ChannelSummarySection[] = [executionSection];

  switch (channel) {
    case "instagram":
      sections = [
        executionSection,
        {
          key: "content_mix",
          title: "Instagram content mix",
          description: "Feed, stories, reels and DM activity.",
          items: [
            { key: "images_uploaded", label: "Images uploaded", value: countJobsByAction(jobs, "publish_post"), description: "Feed photos and carousels." },
            { key: "stories_published", label: "Stories published", value: countJobsByAction(jobs, "publish_story"), description: "Story assets published." },
            { key: "reels_published", label: "Reels published", value: countJobsByAction(jobs, "publish_reel"), description: "Short-form video assets." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent in DM flows." },
            { key: "dms_replied", label: "DMs replied", value: countJobsByAction(jobs, "reply_dm"), description: "Inbox conversations handled." },
          ],
        },
      ];
      break;
    case "linkedin":
      sections = [
        executionSection,
        {
          key: "linkedin_growth",
          title: "LinkedIn growth",
          description: "Company posts, comment engagement, messages, leads and paid campaigns.",
          items: [
            { key: "posts_published", label: "Posts published", value: countJobsByAction(jobs, "publish_post"), description: "Company or profile posts shipped." },
            { key: "comments_replied", label: "Comments replied", value: countJobsByAction(jobs, "reply_comment"), description: "Comment replies completed." },
            { key: "messages_sent", label: "Messages sent", value: countJobsByAction(jobs, "send_message"), description: "Follow-up messages sent." },
            { key: "leads_captured", label: "Leads captured", value: countJobsByAction(jobs, "capture_lead"), description: "Lead capture jobs from LinkedIn activity." },
            { key: "campaigns_managed", label: "Campaigns managed", value: countJobsByAction(jobs, "manage_ad_campaign"), description: "Paid campaign operations." },
          ],
        },
      ];
      break;
    case "youtube":
      sections = [
        executionSection,
        {
          key: "youtube_video_ops",
          title: "YouTube video ops",
          description: "Uploads, comment replies, live chat and media workflow activity.",
          items: [
            { key: "videos_uploaded", label: "Videos uploaded", value: countJobsByAction(jobs, "upload_video"), description: "Videos uploaded or staged." },
            { key: "comments_replied", label: "Comments replied", value: countJobsByAction(jobs, "reply_comment"), description: "Video comments handled." },
            { key: "live_chat_replies", label: "Live chat replies", value: countJobsByAction(jobs, "reply_live_chat"), description: "Live chat messages handled." },
            { key: "media_references", label: "Media references", value: countJobsByAction(jobs, "send_media"), description: "Media references attached to workflows." },
          ],
        },
      ];
      break;
    case "telegram":
      sections = [
        executionSection,
        {
          key: "telegram_bot_ops",
          title: "Telegram bot ops",
          description: "Bot messages, replies, media, broadcasts and human escalation.",
          items: [
            { key: "messages_sent", label: "Messages sent", value: countJobsByAction(jobs, "send_message"), description: "Telegram messages sent." },
            { key: "messages_replied", label: "Messages replied", value: countJobsByAction(jobs, "reply_message"), description: "Telegram inbound messages handled." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent by the bot." },
            { key: "broadcasts_sent", label: "Broadcasts sent", value: countJobsByAction(jobs, "send_broadcast"), description: "Broadcast jobs sent to approved chats." },
            { key: "handoffs", label: "Human handoffs", value: countJobsByAction(jobs, "handoff_agent"), description: "Chats escalated to humans." },
          ],
        },
      ];
      break;
    case "tiktok":
      sections = [
        executionSection,
        {
          key: "video_pipeline",
          title: "TikTok video pipeline",
          description: "Uploads, comments and leads from short-form video.",
          items: [
            { key: "videos_uploaded", label: "Videos uploaded", value: countJobsByAction(jobs, "publish_video"), description: "Videos staged or published." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Assets sent in creator or campaign workflows." },
            { key: "comments_replied", label: "Comments replied", value: countJobsByAction(jobs, "reply_comment"), description: "Public comment responses." },
            { key: "leads_captured", label: "Leads captured", value: countJobsByAction(jobs, "capture_lead"), description: "Lead capture executions." },
          ],
        },
      ];
      break;
    case "email":
      sections = [
        executionSection,
        {
          key: "email_operations",
          title: "Email operations",
          description: "One-off sends, sequences and segmentation activity.",
          items: [
            { key: "emails_sent", label: "Emails sent", value: countJobsByAction(jobs, "send_email"), description: "Single-message sends." },
            { key: "media_sent", label: "Media attachments sent", value: countJobsByAction(jobs, "send_media"), description: "Emails with image or video attachments." },
            { key: "sequences_running", label: "Sequences running", value: countJobsByAction(jobs, "send_sequence"), description: "Sequence enrollments or launches." },
            { key: "contacts_tagged", label: "Contacts tagged", value: countJobsByAction(jobs, "tag_contact"), description: "Segmentation updates." },
          ],
        },
      ];
      break;
    case "facebook":
      sections = [
        executionSection,
        {
          key: "facebook_engagement",
          title: "Facebook engagement",
          description: "Publication, comment handling, DMs and leads.",
          items: [
            { key: "posts_published", label: "Posts published", value: countJobsByAction(jobs, "publish_post"), description: "Feed posts shipped." },
            { key: "comments_replied", label: "Comments replied", value: countJobsByAction(jobs, "reply_comment"), description: "Comment replies completed." },
            { key: "dms_replied", label: "DMs replied", value: countJobsByAction(jobs, "reply_dm"), description: "Messenger-style private replies from Facebook." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Image or video assets sent through inbox flows." },
            { key: "leads_captured", label: "Leads captured", value: countJobsByAction(jobs, "capture_lead"), description: "Lead capture jobs from interaction." },
          ],
        },
      ];
      break;
    case "x":
      sections = [
        executionSection,
        {
          key: "x_conversation",
          title: "X publishing and conversation",
          description: "Posts, mentions and private message activity.",
          items: [
            { key: "posts_published", label: "Posts published", value: countJobsByAction(jobs, "publish_post"), description: "Posts or threads sent to X." },
            { key: "mentions_replied", label: "Mentions replied", value: countJobsByAction(jobs, "reply_mention"), description: "Public mention replies." },
            { key: "dms_sent", label: "DMs sent", value: countJobsByAction(jobs, "send_dm"), description: "Direct messages sent." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent in private outreach." },
          ],
        },
      ];
      break;
    case "whatsapp":
      sections = [
        executionSection,
        {
          key: "whatsapp_inbox",
          title: "WhatsApp inbox",
          description: "Templates, replies and handoff volume.",
          items: [
            { key: "templates_sent", label: "Templates sent", value: countJobsByAction(jobs, "send_template"), description: "Outbound template sends." },
            { key: "messages_replied", label: "Messages replied", value: countJobsByAction(jobs, "reply_message"), description: "Inbox replies sent." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent inside conversations." },
            { key: "handoffs", label: "Human handoffs", value: countJobsByAction(jobs, "handoff_agent"), description: "Escalations to humans." },
          ],
        },
      ];
      break;
    case "messenger":
      sections = [
        executionSection,
        {
          key: "messenger_inbox",
          title: "Messenger inbox",
          description: "Messages, comment replies and escalations.",
          items: [
            { key: "messages_sent", label: "Messages sent", value: countJobsByAction(jobs, "send_message"), description: "Messenger messages delivered." },
            { key: "comments_replied", label: "Comments replied", value: countJobsByAction(jobs, "reply_comment"), description: "Comment-related replies." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent inside Messenger threads." },
            { key: "handoffs", label: "Human handoffs", value: countJobsByAction(jobs, "handoff_agent"), description: "Escalations to human operators." },
          ],
        },
      ];
      break;
    case "customer_support":
      sections = [
        executionSection,
        {
          key: "customer_support_ops",
          title: "Website support assistant",
          description: "Website chat coverage, knowledge help and human escalation.",
          items: [
            { key: "chats_answered", label: "Chats answered", value: countJobsByAction(jobs, "answer_chat"), description: "Website conversations answered by the assistant." },
            { key: "articles_suggested", label: "Articles suggested", value: countJobsByAction(jobs, "suggest_article"), description: "Knowledge base articles suggested during support chats." },
            { key: "tickets_created", label: "Tickets created", value: countJobsByAction(jobs, "capture_ticket"), description: "Support tickets created from website conversations." },
            { key: "media_sent", label: "Media sent", value: countJobsByAction(jobs, "send_media"), description: "Images or videos sent in the website assistant." },
            { key: "handoffs", label: "Human handoffs", value: countJobsByAction(jobs, "handoff_agent"), description: "Chats escalated to a human operator." },
          ],
        },
      ];
      break;
  }

  return {
    channel,
    connected: connectedAccountCount > 0,
    accountCount: accounts.length,
    connectedAccountCount,
    agentCount: agents.length,
    flowCount: flows.length,
    jobCount: jobs.length,
    metrics,
    sections,
  };
}

async function requireChannelAccount(organizationId: string, accountId: string) {
  const client = requireServiceSupabaseClient();
  const account = await getChannelAccountRepository(client, organizationId, accountId);
  if (!account) throw new NotFoundError("Channel account not found.");
  return { client, account };
}

async function requireChannelAgent(organizationId: string, agentId: string) {
  const client = requireServiceSupabaseClient();
  const agent = await getChannelAgentRepository(client, organizationId, agentId);
  if (!agent) throw new NotFoundError("Channel agent not found.");
  return { client, agent };
}

async function requireChannelFlow(organizationId: string, flowId: string) {
  const client = requireServiceSupabaseClient();
  const flow = await getChannelFlowRepository(client, organizationId, flowId);
  if (!flow) throw new NotFoundError("Channel flow not found.");
  return { client, flow };
}

async function requireChannelJob(organizationId: string, jobId: string) {
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, organizationId, jobId);
  if (!job) throw new NotFoundError("Channel job not found.");
  return { client, job };
}

async function resolveCustomerSupportRuntime(client: ReturnType<typeof requireServiceSupabaseClient>, organizationId: string, accountId: string) {
  const [agents, flows] = await Promise.all([
    listChannelAgentsRepository(client, organizationId, "customer_support"),
    listChannelFlowsRepository(client, organizationId, "customer_support"),
  ]);
  const accountAgents = agents.filter((agent) => agent.account_id === accountId && agent.status === "active");
  const accountFlows = flows.filter((flow) => flow.account_id === accountId && flow.status === "active");
  const defaultAgent = accountAgents[0] ?? null;
  const defaultFlow = accountFlows.find((flow) => flow.action_type === "answer_chat") ?? accountFlows[0] ?? null;

  return {
    agent: defaultAgent,
    flow: defaultFlow,
    flowsByAction: Object.fromEntries(accountFlows.map((flow) => [flow.action_type, flow])) as Record<string, (typeof accountFlows)[number] | undefined>,
  };
}

function buildCustomerSupportAssistantPayload(actionType: string, text: string, account: ChannelAccount, sessionId: string, agentName: string | null) {
  if (actionType === "suggest_article") {
    const article = buildCustomerSupportArticle(text, account);
    const baseUrl = buildDefaultOriginFromHandle(account.handle) ?? "https://support.example.com";
    return {
      summary: `Compartí un artículo de ayuda sobre ${article.title.toLowerCase()}.`,
      reply: `Te comparto un artículo que debería resolver esto más rápido: ${article.title}. Si después de revisarlo sigues con el problema, te ayudo a escalarlo.`,
      messageType: "article" as CustomerSupportMessageType,
      metadata: {
        article: {
          title: article.title,
          slug: article.slug,
          url: `${baseUrl.replace(/\/+$/, "")}/help/${article.slug}`,
        },
        sessionId,
        agentName,
      },
    };
  }

  if (actionType === "capture_ticket") {
    const ticketId = buildCustomerSupportTicketId();
    return {
      summary: `Abrí el ticket ${ticketId} para seguimiento humano.`,
      reply: `Ya levanté el ticket ${ticketId}. Un miembro del equipo lo revisará y seguirá el caso contigo.`,
      messageType: "ticket" as CustomerSupportMessageType,
      metadata: {
        ticket: {
          id: ticketId,
          queue: "support",
          priority: "normal",
        },
        sessionId,
        agentName,
      },
    };
  }

  if (actionType === "schedule_appointment") {
    return {
      summary: "Agende una cita tentativa desde el asistente del sitio.",
      reply: "Deje una cita tentativa registrada. Si quieres otro horario, dime la fecha y hora exacta y la ajustamos.",
      messageType: "text" as CustomerSupportMessageType,
      metadata: {
        appointment: {
          status: "scheduled_preview",
          source: "website_chat",
        },
        sessionId,
        agentName,
      },
    };
  }

  if (actionType === "handoff_agent") {
    return {
      summary: "Escalé la conversación a una persona del equipo.",
      reply: "Te voy a pasar con una persona del equipo para seguir este caso contigo. Mientras tanto, ya dejé el contexto listo para que no tengas que repetir todo.",
      messageType: "handoff" as CustomerSupportMessageType,
      metadata: {
        handoff: {
          status: "requested",
          team: "support",
        },
        sessionId,
        agentName,
      },
    };
  }

  return {
    summary: "Respondí el chat desde el asistente del sitio.",
    reply: `Gracias por escribir a ${account.name}. Ya revisé tu mensaje y puedo ayudarte desde aquí. Si lo prefieres, también puedo compartirte ayuda guiada o escalar el caso con una persona.`,
    messageType: "text" as CustomerSupportMessageType,
    metadata: {
      sessionId,
      agentName,
    },
  };
}

export async function listChannelAccounts(organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  const accounts = await listChannelAccountsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel, pagination);
  return accounts.map((account) => ({ ...account, channel: normalizeStoredChannel(account.channel) }));
}

export async function createChannelAccount(input: CreateChannelAccountInput) {
  const client = requireServiceSupabaseClient();
  const channel = parseChannel(input.channel);
  const name = requireNonEmptyString(input.name, "name");
  const handle = optionalString(input.handle, "handle");
  const metadata = channel === "customer_support"
    ? buildCustomerSupportMetadata(name, handle, input.metadata, null)
    : requireRecord(input.metadata, "metadata");
  return createChannelAccountRepository(client, {
    id: crypto.randomUUID(),
    organization_id: requireNonEmptyString(input.organizationId, "organizationId"),
    channel,
    name,
    handle,
    provider: optionalString(input.provider, "provider") ?? "native",
    external_account_id: optionalString(input.externalAccountId, "externalAccountId"),
    status: parseAccountStatus(input.status),
    metadata,
    connected_at: new Date().toISOString()
  });
}

export async function updateChannelAccount(organizationId: string, accountId: string, input: UpdateChannelAccountInput) {
  const { client, account } = await requireChannelAccount(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(accountId, "accountId"));
  const patch: Record<string, unknown> = {};
  const nextName = input.name !== undefined ? requireNonEmptyString(input.name, "name") : account.name;
  const nextHandle = input.handle !== undefined ? optionalString(input.handle, "handle") : account.handle;
  if (input.name !== undefined) patch.name = nextName;
  if (input.handle !== undefined) patch.handle = nextHandle;
  if (input.provider !== undefined) patch.provider = optionalString(input.provider, "provider") ?? account.provider;
  if (input.externalAccountId !== undefined) patch.external_account_id = optionalString(input.externalAccountId, "externalAccountId");
  if (input.status !== undefined) patch.status = parseAccountStatus(input.status);
  if (input.metadata !== undefined) {
    patch.metadata = normalizeStoredChannel(account.channel) === "customer_support"
      ? buildCustomerSupportMetadata(nextName, nextHandle, input.metadata, requireRecord(account.metadata, "metadata"))
      : requireRecord(input.metadata, "metadata");
  }
  return updateChannelAccountRepository(client, account.organization_id, account.id, patch);
}

export async function deleteChannelAccount(organizationId: string, accountId: string) {
  const { client, account } = await requireChannelAccount(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(accountId, "accountId"));
  await deleteChannelAccountRepository(client, account.organization_id, account.id);
}

export async function listChannelAgents(organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  const agents = await listChannelAgentsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel, pagination);
  return agents.map((agent) => ({ ...agent, channel: normalizeStoredChannel(agent.channel) }));
}

export async function createChannelAgent(input: CreateChannelAgentInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (normalizeStoredChannel(account.channel) !== channel) throw new ValidationError("Agent channel must match account channel.");
  const config = normalizeChannelAgentConfig(channel, input.config, input.agentType);
  return createChannelAgentRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    channel,
    name: requireNonEmptyString(input.name, "name"),
    objective: optionalString(input.objective, "objective"),
    persona_prompt: optionalString(input.personaPrompt, "personaPrompt"),
    status: parseBotStatus(input.status),
    config
  });
}

export async function updateChannelAgent(organizationId: string, agentId: string, input: UpdateChannelAgentInput) {
  const { client, agent } = await requireChannelAgent(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(agentId, "agentId"));
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.objective !== undefined) patch.objective = optionalString(input.objective, "objective");
  if (input.personaPrompt !== undefined) patch.persona_prompt = optionalString(input.personaPrompt, "personaPrompt");
  if (input.status !== undefined) patch.status = parseBotStatus(input.status);
  if (input.config !== undefined || input.agentType !== undefined) {
    patch.config = normalizeChannelAgentConfig(normalizeStoredChannel(agent.channel), input.config ?? agent.config, input.agentType);
  }
  return updateChannelAgentRepository(client, agent.organization_id, agent.id, patch);
}

export async function deleteChannelAgent(organizationId: string, agentId: string) {
  const { client, agent } = await requireChannelAgent(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(agentId, "agentId"));
  await deleteChannelAgentRepository(client, agent.organization_id, agent.id);
}

export async function listChannelFlows(organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  const flows = await listChannelFlowsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel, pagination);
  return flows.map((flow) => ({ ...flow, channel: normalizeStoredChannel(flow.channel) }));
}

export async function createChannelFlow(input: CreateChannelFlowInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const actionType = parseChannelAction(channel, input.actionType);
  const triggerType = parseChannelTrigger(channel, input.triggerType);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (normalizeStoredChannel(account.channel) !== channel) throw new ValidationError("Flow channel must match account channel.");
  if (input.agentId) {
    const agent = await getChannelAgentRepository(client, organizationId, input.agentId);
    if (!agent) throw new NotFoundError("Channel agent not found.");
    if (normalizeStoredChannel(agent.channel) !== channel || agent.account_id !== account.id) throw new ValidationError("Flow agent must belong to the same channel account.");
    ensureActionAllowedForAgent(channel, agent.config, actionType);
  }
  return createChannelFlowRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    automation_id: optionalString(input.automationId, "automationId"),
    agent_id: optionalString(input.agentId, "agentId"),
    channel,
    name: requireNonEmptyString(input.name, "name"),
    objective: requireNonEmptyString(input.objective, "objective"),
    trigger_type: triggerType,
    action_type: actionType,
    content_type: optionalString(input.contentType, "contentType"),
    prompt_template: optionalString(input.promptTemplate, "promptTemplate"),
    action_config: requireRecord(input.actionConfig, "actionConfig"),
    status: parseBotStatus(input.status)
  });
}

export async function updateChannelFlow(organizationId: string, flowId: string, input: UpdateChannelFlowInput) {
  const { client, flow } = await requireChannelFlow(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(flowId, "flowId"));
  const patch: Record<string, unknown> = {};
  const normalizedFlowChannel = normalizeStoredChannel(flow.channel);
  const nextActionType = input.actionType !== undefined ? parseChannelAction(normalizedFlowChannel, input.actionType) : flow.action_type;
  if (input.agentId) {
    const agent = await getChannelAgentRepository(client, flow.organization_id, input.agentId);
    if (!agent) throw new NotFoundError("Channel agent not found.");
    if (normalizeStoredChannel(agent.channel) !== normalizedFlowChannel || agent.account_id !== flow.account_id) throw new ValidationError("Flow agent must belong to the same channel account.");
    ensureActionAllowedForAgent(normalizedFlowChannel, agent.config, nextActionType);
  } else if (flow.agent_id) {
    const currentAgent = await getChannelAgentRepository(client, flow.organization_id, flow.agent_id);
    if (currentAgent) ensureActionAllowedForAgent(normalizedFlowChannel, currentAgent.config, nextActionType);
  }
  if (input.agentId !== undefined) patch.agent_id = optionalString(input.agentId, "agentId");
  if (input.automationId !== undefined) patch.automation_id = optionalString(input.automationId, "automationId");
  if (input.name !== undefined) patch.name = requireNonEmptyString(input.name, "name");
  if (input.objective !== undefined) patch.objective = requireNonEmptyString(input.objective, "objective");
  if (input.triggerType !== undefined) patch.trigger_type = parseChannelTrigger(normalizedFlowChannel, input.triggerType);
  if (input.actionType !== undefined) patch.action_type = nextActionType;
  if (input.contentType !== undefined) patch.content_type = optionalString(input.contentType, "contentType");
  if (input.promptTemplate !== undefined) patch.prompt_template = optionalString(input.promptTemplate, "promptTemplate");
  if (input.actionConfig !== undefined) patch.action_config = requireRecord(input.actionConfig, "actionConfig");
  if (input.status !== undefined) patch.status = parseBotStatus(input.status);
  return updateChannelFlowRepository(client, flow.organization_id, flow.id, patch);
}

export async function deleteChannelFlow(organizationId: string, flowId: string) {
  const { client, flow } = await requireChannelFlow(requireNonEmptyString(organizationId, "organizationId"), requireNonEmptyString(flowId, "flowId"));
  await deleteChannelFlowRepository(client, flow.organization_id, flow.id);
}

export async function listChannelJobs(organizationId: string, channel?: ChannelKind, pagination?: { limit: number; offset: number }) {
  const client = requireServiceSupabaseClient();
  const jobs = await listChannelJobsRepository(client, requireNonEmptyString(organizationId, "organizationId"), channel, pagination);
  return jobs.map((job) => ({ ...job, channel: normalizeStoredChannel(job.channel) }));
}

export async function createChannelJob(input: CreateChannelJobInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const channel = parseChannel(input.channel);
  const account = await getChannelAccountRepository(client, organizationId, requireNonEmptyString(input.accountId, "accountId"));
  if (!account) throw new NotFoundError("Channel account not found.");
  if (normalizeStoredChannel(account.channel) !== channel) throw new ValidationError("Job channel must match account channel.");
  const flow = await getChannelFlowRepository(client, organizationId, requireNonEmptyString(input.flowId, "flowId"));
  if (!flow) throw new NotFoundError("Channel flow not found.");
  if (normalizeStoredChannel(flow.channel) !== channel || flow.account_id !== account.id) throw new ValidationError("Job flow must belong to the same channel account.");

  let agentId: string | null = optionalString(input.agentId, "agentId");
  if (agentId) {
    const agent = await getChannelAgentRepository(client, organizationId, agentId);
    if (!agent) throw new NotFoundError("Channel agent not found.");
    if (normalizeStoredChannel(agent.channel) !== channel || agent.account_id !== account.id) throw new ValidationError("Job agent must belong to the same channel account.");
  } else {
    agentId = flow.agent_id;
  }

  const status = parseJobStatus(input.scheduledFor ? "scheduled" : undefined);
  const provider = optionalString(input.provider, "provider") ?? account.provider ?? "native";
  const job = await createChannelJobRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    account_id: account.id,
    flow_id: flow.id,
    agent_id: agentId,
    automation_id: optionalString(input.automationId, "automationId") ?? flow.automation_id,
    contact_id: optionalString(input.contactId, "contactId"),
    channel,
    title: requireNonEmptyString(input.title, "title"),
    target_ref: optionalString(input.targetRef, "targetRef"),
    payload: requireRecord(input.payload, "payload"),
    provider,
    provider_job_id: null,
    status,
    outcome: status === "scheduled" ? "scheduled" : "manual_review",
    provider_error: provider === "native" ? "Platform connector pending configuration." : null,
    result_summary: provider === "native" ? "Job created and waiting for a platform connector." : null,
    scheduled_for: optionalString(input.scheduledFor, "scheduledFor"),
    started_at: null,
    ended_at: null,
    result_payload: {}
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    channel_job_id: job.id,
    provider,
    event_type: "queued",
    payload: { flowId: flow.id, agentId, channel, title: job.title, targetRef: job.target_ref, payload: job.payload }
  });

  return job;
}

export async function executeChannelJob(organizationId: string, jobId: string) {
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const normalizedJobId = requireNonEmptyString(jobId, "jobId");
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, normalizedOrganizationId, normalizedJobId);
  if (!job) throw new NotFoundError("Channel job not found.");
  const flow = await getChannelFlowRepository(client, normalizedOrganizationId, job.flow_id);
  if (!flow) throw new NotFoundError("Channel flow not found.");

  const started = await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "running",
    provider_error: null,
    started_at: new Date().toISOString()
  });
  const normalizedStartedChannel = normalizeStoredChannel(started.channel);

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: started.id,
    provider: started.provider,
    event_type: "running",
    payload: { actionType: flow.action_type, provider: started.provider }
  });

  const connector = getChannelConnector(normalizedStartedChannel);
  let result: { outcome: ChannelJobOutcome; summary: string; resultPayload: Record<string, unknown>; isPreview: boolean };

  if (flow.action_type === "schedule_appointment") {
    result = await executeScheduleAppointmentTool(client, normalizedOrganizationId, started, flow);
  } else if (connector) {
    const real = await connector.execute(started, flow);
    result = { outcome: real.outcome, summary: real.summary, resultPayload: real.resultPayload, isPreview: false };
  } else {
    const preview = buildExecutionPreview(flow.action_type);
    result = {
      outcome: preview.outcome,
      summary: preview.summary,
      resultPayload: buildPreviewResultPayload(normalizedStartedChannel, flow.action_type, started),
      isPreview: true,
    };
  }

  const completed = await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "completed",
    outcome: result.outcome,
    result_summary: result.summary,
    provider_error: result.isPreview ? "Preview mode only. External connector is not configured." : null,
    result_payload: result.resultPayload,
    ended_at: new Date().toISOString()
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: completed.id,
    provider: completed.provider,
    event_type: result.isPreview ? "completed.preview" : "completed",
    payload: completed.result_payload
  });

  return completed;
}

export async function retryChannelJob(organizationId: string, jobId: string) {
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const normalizedJobId = requireNonEmptyString(jobId, "jobId");
  const client = requireServiceSupabaseClient();
  const job = await getChannelJobRepository(client, normalizedOrganizationId, normalizedJobId);
  if (!job) throw new NotFoundError("Channel job not found.");

  await updateChannelJobRepository(client, normalizedOrganizationId, normalizedJobId, {
    status: "queued",
    outcome: "manual_review",
    provider_error: null,
    result_summary: "Job requeued for preview execution.",
    started_at: null,
    ended_at: null,
    result_payload: {}
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: normalizedOrganizationId,
    channel_job_id: normalizedJobId,
    provider: job.provider,
    event_type: "requeued",
    payload: { previousStatus: job.status }
  });

  return executeChannelJob(normalizedOrganizationId, normalizedJobId);
}

export async function markChannelJobCompleted(input: CompleteChannelJobInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const jobId = requireNonEmptyString(input.jobId, "jobId");
  const updated = await updateChannelJobRepository(client, organizationId, jobId, {
    status: "completed",
    outcome: "published",
    result_summary: optionalString(input.resultSummary, "resultSummary") ?? "Job completed manually.",
    result_payload: requireRecord(input.resultPayload, "resultPayload"),
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  });

  await createChannelJobEventRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    channel_job_id: updated.id,
    provider: updated.provider,
    event_type: "completed.manual",
    payload: updated.result_payload
  });

  return updated;
}

export async function getCustomerSupportWidgetConfig(publicWidgetKey: string, origin?: string, sourceUrl?: string) {
  const client = requireServiceSupabaseClient();
  const normalizedPublicWidgetKey = requireNonEmptyString(publicWidgetKey, "publicWidgetKey");
  const account = await getCustomerSupportAccountByWidgetKeyRepository(client, normalizedPublicWidgetKey);
  if (!account || normalizeStoredChannel(account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support widget not found.");
  }

  const widget = getCustomerSupportWidgetSettings(account);
  assertCustomerSupportOrigin(requireRecord(account.metadata, "metadata"), origin ?? null, sourceUrl ?? null);
  const runtime = await resolveCustomerSupportRuntime(client, account.organization_id, account.id);

  return {
    accountId: account.id,
    name: account.name,
    handle: account.handle,
    widget: {
      title: widget.title,
      greeting: widget.greeting,
      agentLabel: runtime.agent?.name ?? widget.agentLabel,
      accentColor: widget.accentColor,
    },
    capabilities: {
      canAnswerChat: Boolean(runtime.flowsByAction.answer_chat),
      canScheduleAppointment: Boolean(runtime.flowsByAction.schedule_appointment),
      canSuggestArticle: Boolean(runtime.flowsByAction.suggest_article),
      canCreateTicket: Boolean(runtime.flowsByAction.capture_ticket),
      canSendMedia: Boolean(runtime.flowsByAction.send_media),
      canHandoff: Boolean(runtime.flowsByAction.handoff_agent),
    },
  };
}

export async function createCustomerSupportWidgetSession(input: CreateCustomerSupportWidgetSessionInput) {
  const client = requireServiceSupabaseClient();
  const publicWidgetKey = requireNonEmptyString(input.publicWidgetKey, "publicWidgetKey");
  const account = await getCustomerSupportAccountByWidgetKeyRepository(client, publicWidgetKey);
  if (!account || normalizeStoredChannel(account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support widget not found.");
  }
  assertCustomerSupportOrigin(requireRecord(account.metadata, "metadata"), input.origin ?? null, input.sourceUrl ?? null);

  const runtime = await resolveCustomerSupportRuntime(client, account.organization_id, account.id);
  const session = await createCustomerSupportSessionRepository(client, {
    id: crypto.randomUUID(),
    organization_id: account.organization_id,
    account_id: account.id,
    agent_id: runtime.agent?.id ?? null,
    flow_id: runtime.flow?.id ?? null,
    public_widget_key: publicWidgetKey,
    visitor_id: optionalString(input.visitorId, "visitorId"),
    visitor_name: optionalString(input.visitorName, "visitorName"),
    visitor_email: optionalString(input.visitorEmail, "visitorEmail"),
    visitor_metadata: requireRecord(input.visitorMetadata, "visitorMetadata"),
    source_url: optionalString(input.sourceUrl, "sourceUrl"),
    origin: normalizeOriginValue(input.origin) ?? normalizeOriginValue(input.sourceUrl ?? null),
    status: "active",
    summary: null,
    handoff_requested_at: null,
    last_message_at: new Date().toISOString(),
  });
  const messages = await listCustomerSupportMessagesRepository(client, session.id);
  const widget = getCustomerSupportWidgetSettings(account);

  return {
    session,
    messages,
    widget: {
      title: widget.title,
      greeting: widget.greeting,
      agentLabel: runtime.agent?.name ?? widget.agentLabel,
      accentColor: widget.accentColor,
    },
  };
}

export async function getCustomerSupportWidgetSession(sessionId: string, origin?: string) {
  const client = requireServiceSupabaseClient();
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(sessionId, "sessionId"));
  if (!session) throw new NotFoundError("Customer support session not found.");
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support session account not found.");
  }
  assertCustomerSupportOrigin(requireRecord(session.account.metadata, "metadata"), origin ?? session.origin ?? null, session.source_url);
  const messages = await listCustomerSupportMessagesRepository(client, session.id);
  return { session, messages };
}

export async function sendCustomerSupportWidgetMessage(input: SendCustomerSupportWidgetMessageInput) {
  const client = requireServiceSupabaseClient();
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(input.sessionId, "sessionId"));
  if (!session) throw new NotFoundError("Customer support session not found.");
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support account not found.");
  }

  assertCustomerSupportOrigin(requireRecord(session.account.metadata, "metadata"), input.origin ?? session.origin ?? null, session.source_url);
  const text = requireNonEmptyString(input.text, "text");
  const visitorMessage = await createCustomerSupportMessageRepository(client, {
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    session_id: session.id,
    role: "visitor",
    message_type: "text",
    content: text,
    metadata: requireRecord(input.metadata, "metadata"),
  });

  const runtime = await resolveCustomerSupportRuntime(client, session.organization_id, session.account_id);
  const requestedAction = chooseCustomerSupportAction(text);
  const flow = runtime.flowsByAction[requestedAction]
    ?? runtime.flowsByAction.answer_chat
    ?? runtime.flow;
  if (!flow) throw new ValidationError("No active customer support routine is configured for this account.");
  const assistantPayload = buildCustomerSupportAssistantPayload(flow.action_type, text, session.account as ChannelAccount, session.id, runtime.agent?.name ?? null);

  const executedJob = await executeChannelJob(
    session.organization_id,
    (
      await createChannelJob({
        organizationId: session.organization_id,
        accountId: session.account_id,
        flowId: flow.id,
        agentId: runtime.agent?.id ?? session.agent_id ?? undefined,
        channel: "customer_support",
        title: `${assistantPayload.messageType === "ticket" ? "Ticket" : assistantPayload.messageType === "article" ? "Ayuda" : assistantPayload.messageType === "handoff" ? "Handoff" : "Chat"} · ${text.slice(0, 48)}`,
        targetRef: `session:${session.id}`,
        payload: {
          sessionId: session.id,
          message: text,
          visitorId: session.visitor_id,
          visitorName: session.visitor_name,
          visitorEmail: session.visitor_email,
          origin: input.origin ?? session.origin,
        },
      })
    ).id
  );

  const assistantMessage = await createCustomerSupportMessageRepository(client, {
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    session_id: session.id,
    role: "assistant",
    message_type: assistantPayload.messageType,
    content: assistantPayload.reply,
    metadata: {
      ...assistantPayload.metadata,
      jobId: executedJob.id,
      flowId: flow.id,
      actionType: flow.action_type,
      preview: executedJob.result_payload,
    },
  });

  const allMessages = await listCustomerSupportMessagesRepository(client, session.id);
  const nextStatus =
    flow.action_type === "handoff_agent" ? "handoff_requested"
    : flow.action_type === "capture_ticket" ? "resolved"
    : session.status;
  const updatedSession = await updateCustomerSupportSessionRepository(client, session.id, {
    agent_id: runtime.agent?.id ?? session.agent_id,
    flow_id: flow.id,
    status: nextStatus,
    last_message_at: new Date().toISOString(),
    summary: summarizeCustomerSupportSession(allMessages),
    handoff_requested_at: nextStatus === "handoff_requested" ? new Date().toISOString() : session.handoff_requested_at,
  });

  return {
    session: updatedSession,
    visitorMessage,
    assistantMessage,
    job: executedJob,
    messages: await listCustomerSupportMessagesRepository(client, session.id),
  };
}

export async function requestCustomerSupportHandoff(input: RequestCustomerSupportHandoffInput) {
  const client = requireServiceSupabaseClient();
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(input.sessionId, "sessionId"));
  if (!session) throw new NotFoundError("Customer support session not found.");
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support account not found.");
  }
  assertCustomerSupportOrigin(requireRecord(session.account.metadata, "metadata"), input.origin ?? session.origin ?? null, session.source_url);

  const reason = optionalString(input.reason, "reason") ?? "El visitante solicitó hablar con una persona.";
  const systemMessage = await createCustomerSupportMessageRepository(client, {
    id: crypto.randomUUID(),
    organization_id: session.organization_id,
    session_id: session.id,
    role: "assistant",
    message_type: "handoff",
    content: "Voy a escalar esta conversación con una persona del equipo. Ya dejé el contexto listo para que continúen desde donde se quedó el chat.",
    metadata: {
      reason,
      ...(requireRecord(input.metadata, "metadata")),
    },
  });
  const updatedSession = await updateCustomerSupportSessionRepository(client, session.id, {
    status: "handoff_requested",
    handoff_requested_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    summary: reason,
  });
  return {
    session: updatedSession,
    message: systemMessage,
    messages: await listCustomerSupportMessagesRepository(client, session.id),
  };
}

export async function listCustomerSupportInboxSessions(input: ListCustomerSupportInboxSessionsInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const accountId = optionalString(input.accountId, "accountId");

  if (accountId) {
    const account = await getChannelAccountRepository(client, organizationId, accountId);
    if (!account || normalizeStoredChannel(account.channel) !== "customer_support") {
      throw new NotFoundError("Customer support account not found.");
    }
  }

  return listCustomerSupportSessionsRepository(client, organizationId, accountId ?? undefined, input.pagination);
}

export async function getCustomerSupportInboxSession(organizationId: string, sessionId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(sessionId, "sessionId"));
  if (!session || session.organization_id !== normalizedOrganizationId) {
    throw new NotFoundError("Customer support session not found.");
  }
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support account not found.");
  }

  return {
    session,
    messages: await listCustomerSupportMessagesRepository(client, session.id),
  };
}

export async function sendCustomerSupportInboxReply(input: SendCustomerSupportInboxReplyInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(input.sessionId, "sessionId"));
  if (!session || session.organization_id !== organizationId) {
    throw new NotFoundError("Customer support session not found.");
  }
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support account not found.");
  }

  const reply = await createCustomerSupportMessageRepository(client, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    session_id: session.id,
    role: "assistant",
    message_type: "text",
    content: requireNonEmptyString(input.text, "text"),
    metadata: {
      source: "human_inbox",
      authorType: "human",
      agentName: optionalString(input.agentName, "agentName") ?? "Agente humano",
      ...(requireRecord(input.metadata, "metadata")),
    },
  });

  const messages = await listCustomerSupportMessagesRepository(client, session.id);
  const nextStatus = input.markAsResolved
    ? "resolved"
    : session.status === "resolved" || session.status === "closed"
      ? "active"
      : session.status;
  const updatedSession = await updateCustomerSupportSessionRepository(client, session.id, {
    status: nextStatus,
    last_message_at: new Date().toISOString(),
    summary: summarizeCustomerSupportSession(messages),
  });

  return {
    session: updatedSession,
    message: reply,
    messages,
  };
}

export async function updateCustomerSupportInboxSession(input: UpdateCustomerSupportInboxSessionInput) {
  const client = requireServiceSupabaseClient();
  const organizationId = requireNonEmptyString(input.organizationId, "organizationId");
  const session = await getCustomerSupportSessionRepository(client, requireNonEmptyString(input.sessionId, "sessionId"));
  if (!session || session.organization_id !== organizationId) {
    throw new NotFoundError("Customer support session not found.");
  }
  if (!session.account || normalizeStoredChannel(session.account.channel) !== "customer_support") {
    throw new NotFoundError("Customer support account not found.");
  }

  const status = parseCustomerSupportSessionStatus(input.status);
  const updatedSession = await updateCustomerSupportSessionRepository(client, session.id, {
    status,
    summary: input.summary !== undefined ? optionalString(input.summary, "summary") : session.summary,
    last_message_at: new Date().toISOString(),
    handoff_requested_at:
      status === "handoff_requested"
        ? (session.handoff_requested_at ?? new Date().toISOString())
        : session.handoff_requested_at,
  });

  return {
    session: updatedSession,
    messages: await listCustomerSupportMessagesRepository(client, session.id),
  };
}

export async function getChannelAutomationSnapshot(organizationId: string) {
  const client = requireServiceSupabaseClient();
  const normalizedOrganizationId = requireNonEmptyString(organizationId, "organizationId");
  const [accounts, agents, flows, jobs, contacts, automations] = await Promise.all([
    listChannelAccountsRepository(client, normalizedOrganizationId),
    listChannelAgentsRepository(client, normalizedOrganizationId),
    listChannelFlowsRepository(client, normalizedOrganizationId),
    listChannelJobsRepository(client, normalizedOrganizationId),
    client.from("contacts").select("id, full_name, phone, company").eq("organization_id", normalizedOrganizationId).order("full_name", { ascending: true }).limit(100),
    client.from("automations").select("id, name, description, trigger_type, action_type, status").eq("organization_id", normalizedOrganizationId).order("updated_at", { ascending: false }).limit(50)
  ]);

  if (contacts.error) throw new Error(contacts.error.message);
  if (automations.error) throw new Error(automations.error.message);

  const normalizedAccounts = accounts.map((account) => ({ ...account, channel: normalizeStoredChannel(account.channel) }));
  const normalizedAgents = agents.map((agent) => ({ ...agent, channel: normalizeStoredChannel(agent.channel) }));
  const normalizedFlows = flows.map((flow) => ({ ...flow, channel: normalizeStoredChannel(flow.channel) }));
  const normalizedJobs = jobs.map((job) => ({ ...job, channel: normalizeStoredChannel(job.channel) }));

  return {
    channels: Object.fromEntries(
      Object.entries(CHANNEL_ACTIONS).map(([channel, actions]) => [
        channel,
        {
          actions,
          triggers: CHANNEL_TRIGGERS[channel as ChannelKind],
          agentTypes: getChannelAgentTypes(channel as ChannelKind),
        },
      ])
    ),
    channelSummaries: Object.fromEntries(
      Object.keys(CHANNEL_ACTIONS).map((channel) => [
        channel,
        buildChannelSummary(channel as ChannelKind, {
          accounts: normalizedAccounts,
          agents: normalizedAgents,
          flows: normalizedFlows,
          jobs: normalizedJobs,
        }),
      ])
    ),
    accounts: normalizedAccounts,
    agents: normalizedAgents,
    flows: normalizedFlows,
    jobs: normalizedJobs,
    contacts: contacts.data ?? [],
    automations: automations.data ?? []
  };
}
