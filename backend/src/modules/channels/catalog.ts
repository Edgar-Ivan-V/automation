/**
 * FILE: src/modules/channels/catalog.ts
 *
 * Catálogo estático de canales y acciones disponibles en el sistema.
 * Define qué se puede hacer en cada plataforma social/comunicación.
 *
 * SUPPORTED_CHANNELS: lista de todos los canales soportados.
 *
 * CHANNEL_ACTIONS: mapa canal → lista de acciones disponibles.
 * Cada acción tiene:
 *   - action_type: identificador interno (ej: "publish_post")
 *   - label: nombre legible para mostrar en UI
 *   - content_type: tipo de contenido esperado (post, video, email…)
 *   - description: explicación breve de la acción
 *
 * Canales y sus acciones:
 *   - automations: workflow_run, lead_routing, crm_update
 *   - email: send_email, send_sequence, tag_contact
 *   - facebook: reply_comment, reply_dm, publish_post, capture_lead
 *   - instagram: publish_post, publish_story, publish_reel, reply_dm
 *   - x: publish_post, reply_mention, send_dm
 *   - tiktok: publish_video, reply_comment, capture_lead
 *   - whatsapp: send_template, reply_message, handoff_agent
 *   - messenger: send_message, reply_comment, handoff_agent
 *
 * isSupportedChannel(value): type guard para validar ChannelKind.
 */

import type {
  ChannelActionDefinition,
  ChannelAgentTypeDefinition,
  ChannelKind,
  ChannelTriggerDefinition,
} from "./types.js";

export const SUPPORTED_CHANNELS: ChannelKind[] = [
  "automations",
  "email",
  "facebook",
  "instagram",
  "x",
  "tiktok",
  "whatsapp",
  "messenger"
];

export const CHANNEL_ACTIONS: Record<ChannelKind, ChannelActionDefinition[]> = {
  automations: [
    { action_type: "workflow_run", label: "Run workflow", description: "Executes a generic workflow or business process." },
    { action_type: "lead_routing", label: "Route lead", description: "Assigns a lead to an internal owner or queue." },
    { action_type: "crm_update", label: "Update CRM", description: "Updates a CRM record or pipeline stage." }
  ],
  email: [
    { action_type: "send_email", label: "Send email", content_type: "email", description: "Sends a one-off email message." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an email with an image or video attachment." },
    { action_type: "send_sequence", label: "Send sequence", content_type: "email", description: "Sends a multi-step follow-up sequence." },
    { action_type: "tag_contact", label: "Tag contact", description: "Adds tags or segments to the recipient." }
  ],
  facebook: [
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment on a Facebook post." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Sends a direct message response." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to Facebook inbox or outreach flows." },
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a feed post to Facebook." },
    { action_type: "capture_lead", label: "Capture lead", description: "Creates or updates a lead from a Facebook interaction." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on Facebook." }
  ],
  instagram: [
    { action_type: "publish_post", label: "Publish photo", content_type: "photo", description: "Publishes a photo post to the Instagram feed." },
    { action_type: "publish_story", label: "Publish story", content_type: "story", description: "Publishes a story asset to Instagram stories." },
    { action_type: "publish_reel", label: "Publish reel", content_type: "video", description: "Publishes a video reel to Instagram." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Replies to an Instagram direct message." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset inside Instagram DM workflows." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on Instagram." }
  ],
  x: [
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a post on X." },
    { action_type: "reply_mention", label: "Reply mention", content_type: "reply", description: "Replies to a mention or thread." },
    { action_type: "send_dm", label: "Send DM", content_type: "message", description: "Sends a direct message on X." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to X conversations or outreach." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on X." }
  ],
  tiktok: [
    { action_type: "publish_video", label: "Publish video", content_type: "video", description: "Publishes a TikTok video asset." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a TikTok comment." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to TikTok creator or campaign workflows." },
    { action_type: "capture_lead", label: "Capture lead", description: "Captures a lead from profile or campaign traffic." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on TikTok." }
  ],
  whatsapp: [
    { action_type: "send_template", label: "Send template", content_type: "template", description: "Sends a WhatsApp template message." },
    { action_type: "reply_message", label: "Reply message", content_type: "message", description: "Replies to a WhatsApp conversation." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video inside a WhatsApp conversation." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Escalates a conversation to a human operator." }
  ],
  messenger: [
    { action_type: "send_message", label: "Send message", content_type: "message", description: "Sends a Messenger message." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment from a Messenger-linked source." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video inside a Messenger thread." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Transfers a conversation to a human operator." }
  ]
};

export const CHANNEL_TRIGGERS: Record<ChannelKind, ChannelTriggerDefinition[]> = {
  automations: [
    { trigger_type: "manual", label: "Manual", description: "Run the workflow from the operator panel." },
    { trigger_type: "scheduled_run", label: "Scheduled run", description: "Runs on a schedule." },
    { trigger_type: "crm_stage_changed", label: "CRM stage changed", description: "Runs when a record changes stage." },
    { trigger_type: "webhook_event", label: "Webhook event", description: "Runs when an external webhook arrives." },
  ],
  email: [
    { trigger_type: "manual", label: "Manual", description: "Launch the email flow manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Runs every day from a content calendar or cohort." },
    { trigger_type: "new_lead", label: "New lead", description: "Runs when a new lead enters the workspace." },
    { trigger_type: "stage_changed", label: "Stage changed", description: "Runs when a CRM stage or segment changes." },
  ],
  facebook: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Publishes or refreshes content on a cadence." },
    { trigger_type: "new_comment", label: "New comment", description: "Runs when a new comment appears on a post." },
    { trigger_type: "new_dm", label: "New DM", description: "Runs when a new private message arrives." },
    { trigger_type: "campaign_window", label: "Campaign window", description: "Runs when a paid campaign period starts." },
  ],
  instagram: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Publishes content from a daily queue." },
    { trigger_type: "new_dm", label: "New DM", description: "Runs when a new Instagram DM arrives." },
    { trigger_type: "campaign_window", label: "Campaign window", description: "Runs when a paid promotion period starts." },
  ],
  x: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Publishes content or threads from a queue." },
    { trigger_type: "new_mention", label: "New mention", description: "Runs when a mention or thread reply appears." },
    { trigger_type: "campaign_window", label: "Campaign window", description: "Runs when a paid campaign or push window starts." },
  ],
  tiktok: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Publishes videos from the queue." },
    { trigger_type: "new_comment", label: "New comment", description: "Runs when a new comment appears on a video." },
    { trigger_type: "campaign_window", label: "Campaign window", description: "Runs when a paid campaign period starts." },
  ],
  whatsapp: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "new_message", label: "New message", description: "Runs when a new WhatsApp message arrives." },
    { trigger_type: "follow_up_due", label: "Follow-up due", description: "Runs when a follow-up window becomes due." },
    { trigger_type: "handoff_requested", label: "Handoff requested", description: "Runs when the conversation should escalate." },
  ],
  messenger: [
    { trigger_type: "manual", label: "Manual", description: "Launch the action manually." },
    { trigger_type: "new_message", label: "New message", description: "Runs when a new Messenger message arrives." },
    { trigger_type: "new_comment", label: "New comment", description: "Runs when a new linked comment appears." },
    { trigger_type: "handoff_requested", label: "Handoff requested", description: "Runs when the conversation should escalate." },
  ],
};

export const CHANNEL_AGENT_TYPES: ChannelAgentTypeDefinition[] = [
  {
    agent_type: "dm_responder",
    label: "Responder DMs",
    description: "Agente para inbox privado, seguimiento y atención uno a uno.",
    allowed_action_types: ["reply_dm", "reply_message", "send_message", "send_dm", "send_template", "send_media"],
    config_fields: [
      {
        key: "responseStyle",
        label: "Estilo de respuesta",
        options: [
          { value: "brief", label: "Breve" },
          { value: "consultative", label: "Consultivo" },
          { value: "support", label: "Soporte" },
        ],
      },
      {
        key: "escalationPolicy",
        label: "Escalado",
        options: [
          { value: "qualified_only", label: "Solo si califica" },
          { value: "always", label: "Siempre escalar" },
          { value: "never", label: "Nunca escalar" },
        ],
      },
      {
        key: "inboxPriority",
        label: "Prioridad",
        options: [
          { value: "recent_first", label: "Mas recientes" },
          { value: "vip_first", label: "VIP primero" },
          { value: "lead_first", label: "Potenciales leads" },
        ],
      },
    ],
  },
  {
    agent_type: "comment_responder",
    label: "Responder comentarios",
    description: "Agente para replies públicos, moderación y detección de intención.",
    allowed_action_types: ["reply_comment", "reply_mention"],
    config_fields: [
      {
        key: "responseTone",
        label: "Tono",
        options: [
          { value: "friendly", label: "Amigable" },
          { value: "brand_safe", label: "Brand safe" },
          { value: "assertive", label: "Directo" },
        ],
      },
      {
        key: "moderationMode",
        label: "Moderación",
        options: [
          { value: "reply_all", label: "Responder todo" },
          { value: "hide_risky", label: "Ocultar riesgo" },
          { value: "high_intent_only", label: "Solo alta intención" },
        ],
      },
      {
        key: "leadDetection",
        label: "Detección de lead",
        options: [
          { value: "off", label: "Apagada" },
          { value: "mentions_price", label: "Si pregunta precio" },
          { value: "mentions_purchase", label: "Si muestra compra" },
        ],
      },
    ],
  },
  {
    agent_type: "publisher",
    label: "Subir posts y videos",
    description: "Agente para contenido programado, assets y publicación diaria.",
    allowed_action_types: ["publish_post", "publish_story", "publish_reel", "publish_video", "send_email", "send_sequence", "send_media"],
    config_fields: [
      {
        key: "publishCadence",
        label: "Cadencia",
        options: [
          { value: "daily", label: "Diaria" },
          { value: "weekdays", label: "Lunes a viernes" },
          { value: "campaign_only", label: "Solo campañas" },
        ],
      },
      {
        key: "assetSource",
        label: "Fuente de assets",
        options: [
          { value: "library", label: "Libreria" },
          { value: "folder", label: "Carpeta" },
          { value: "calendar_queue", label: "Cola de calendario" },
        ],
      },
      {
        key: "approvalMode",
        label: "Aprobación",
        options: [
          { value: "manual", label: "Manual" },
          { value: "auto_after_review", label: "Auto tras revisión" },
          { value: "full_auto", label: "Full auto" },
        ],
      },
    ],
  },
  {
    agent_type: "ads_operator",
    label: "Configurar publicidad",
    description: "Agente para campañas pagadas, presupuesto y optimización.",
    allowed_action_types: ["manage_ad_campaign"],
    config_fields: [
      {
        key: "campaignGoal",
        label: "Objetivo",
        options: [
          { value: "leads", label: "Leads" },
          { value: "traffic", label: "Tráfico" },
          { value: "engagement", label: "Engagement" },
        ],
      },
      {
        key: "budgetMode",
        label: "Presupuesto",
        options: [
          { value: "fixed", label: "Fijo" },
          { value: "scaled", label: "Escalable" },
          { value: "capped_test", label: "Test capado" },
        ],
      },
      {
        key: "optimizationMode",
        label: "Optimización",
        options: [
          { value: "manual", label: "Manual" },
          { value: "cost_cap", label: "Cost cap" },
          { value: "maximize_results", label: "Maximizar resultados" },
        ],
      },
    ],
  },
];

export function getChannelAgentTypes(channel: ChannelKind): ChannelAgentTypeDefinition[] {
  const allowedActionTypes = new Set(CHANNEL_ACTIONS[channel].map((action) => action.action_type));
  return CHANNEL_AGENT_TYPES.filter((definition) => definition.allowed_action_types.some((actionType) => allowedActionTypes.has(actionType)));
}

export function isSupportedChannel(value: string): value is ChannelKind {
  return SUPPORTED_CHANNELS.includes(value as ChannelKind);
}
