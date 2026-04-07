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
 *   - customer_support: answer_chat, suggest_article, capture_ticket, send_media, handoff_agent
 *   - email: send_email, send_sequence, tag_contact
 *   - facebook: reply_comment, reply_message, reply_dm, publish_post, capture_lead
 *   - instagram: publish_post, publish_story, publish_reel, reply_message, reply_dm
 *   - linkedin: publish_post, reply_comment, reply_message, send_message, capture_lead, manage_ad_campaign
 *   - youtube: upload_video, reply_comment, reply_live_chat, send_media
 *   - telegram: send_message, reply_message, send_media, send_broadcast, handoff_agent
 *   - x: publish_post, reply_mention, reply_message, send_dm
 *   - tiktok: publish_video, reply_comment, capture_lead
 *   - whatsapp: send_template, reply_message, handoff_agent
 *   - messenger: reply_message, send_message, reply_comment, handoff_agent
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
  "customer_support",
  "email",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "telegram",
  "x",
  "tiktok",
  "whatsapp",
  "messenger"
];

export const CHANNEL_ACTIONS: Record<ChannelKind, ChannelActionDefinition[]> = {
  customer_support: [
    { action_type: "answer_chat", label: "Answer website chat", content_type: "message", description: "Replies to a website support or sales conversation." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to a website support message." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from the conversation context." },
    { action_type: "suggest_article", label: "Suggest knowledge article", content_type: "article", description: "Shares a help article or FAQ with the visitor." },
    { action_type: "capture_ticket", label: "Create support ticket", content_type: "ticket", description: "Creates a ticket or follow-up case for the support team." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video inside the website chat." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Escalates the website chat to a human support or sales operator." }
  ],
  email: [
    { action_type: "send_email", label: "Send email", content_type: "email", description: "Sends a one-off email message." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from an email lead or follow-up." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an email with an image or video attachment." },
    { action_type: "send_sequence", label: "Send sequence", content_type: "email", description: "Sends a multi-step follow-up sequence." },
    { action_type: "tag_contact", label: "Tag contact", description: "Adds tags or segments to the recipient." }
  ],
  facebook: [
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment on a Facebook post." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to a Facebook inbox message." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Sends a direct message response." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a Facebook conversation." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to Facebook inbox or outreach flows." },
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a feed post to Facebook." },
    { action_type: "capture_lead", label: "Capture lead", description: "Creates or updates a lead from a Facebook interaction." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on Facebook." }
  ],
  instagram: [
    { action_type: "publish_post", label: "Publish photo", content_type: "photo", description: "Publishes a photo post to the Instagram feed." },
    { action_type: "publish_story", label: "Publish story", content_type: "story", description: "Publishes a story asset to Instagram stories." },
    { action_type: "publish_reel", label: "Publish reel", content_type: "video", description: "Publishes a video reel to Instagram." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to an Instagram inbox message." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Replies to an Instagram direct message." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from an Instagram DM." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset inside Instagram DM workflows." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on Instagram." }
  ],
  linkedin: [
    { action_type: "publish_post", label: "Publish company post", content_type: "post", description: "Publishes a post to a LinkedIn organization or profile." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to comments on LinkedIn posts." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to a LinkedIn message when a provider connector is configured." },
    { action_type: "send_message", label: "Send message", content_type: "message", description: "Sends a LinkedIn follow-up message when a provider connector is configured." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a LinkedIn lead or message." },
    { action_type: "capture_lead", label: "Capture lead", description: "Creates or updates a lead from a LinkedIn interaction." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a LinkedIn paid campaign." }
  ],
  youtube: [
    { action_type: "upload_video", label: "Upload video", content_type: "video", description: "Uploads or stages a video for a YouTube channel." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a YouTube video comment." },
    { action_type: "reply_live_chat", label: "Reply live chat", content_type: "message", description: "Replies to a live chat message during a stream." },
    { action_type: "send_media", label: "Attach media reference", content_type: "media", description: "Stores or sends a video/media asset reference for YouTube workflows." }
  ],
  telegram: [
    { action_type: "send_message", label: "Send message", content_type: "message", description: "Sends a Telegram bot message." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies to a Telegram user or group message." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a Telegram conversation." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends media through a Telegram bot." },
    { action_type: "send_broadcast", label: "Send broadcast", content_type: "message", description: "Sends a broadcast to an allowed Telegram chat or group." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Escalates a Telegram conversation to a human operator." }
  ],
  x: [
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a post on X." },
    { action_type: "reply_mention", label: "Reply mention", content_type: "reply", description: "Replies to a mention or thread." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to a private X message." },
    { action_type: "send_dm", label: "Send DM", content_type: "message", description: "Sends a direct message on X." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from an X conversation." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to X conversations or outreach." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on X." }
  ],
  tiktok: [
    { action_type: "publish_video", label: "Publish video", content_type: "video", description: "Publishes a TikTok video asset." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a TikTok comment." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a TikTok lead." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video asset to TikTok creator or campaign workflows." },
    { action_type: "capture_lead", label: "Capture lead", description: "Captures a lead from profile or campaign traffic." },
    { action_type: "manage_ad_campaign", label: "Manage ad campaign", content_type: "campaign", description: "Creates or updates a paid campaign on TikTok." }
  ],
  whatsapp: [
    { action_type: "send_template", label: "Send template", content_type: "template", description: "Sends a WhatsApp template message." },
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies to a WhatsApp conversation." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a WhatsApp conversation." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video inside a WhatsApp conversation." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Escalates a conversation to a human operator." }
  ],
  messenger: [
    { action_type: "reply_message", label: "Responder mensajes", content_type: "message", description: "Replies manually to a Messenger conversation." },
    { action_type: "send_message", label: "Send message", content_type: "message", description: "Sends a Messenger message." },
    { action_type: "schedule_appointment", label: "Agendar cita", content_type: "appointment", description: "Schedules a test appointment from a Messenger conversation." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment from a Messenger-linked source." },
    { action_type: "send_media", label: "Send image or video", content_type: "media", description: "Sends an image or video inside a Messenger thread." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Transfers a conversation to a human operator." }
  ]
};

export const CHANNEL_TRIGGERS: Record<ChannelKind, ChannelTriggerDefinition[]> = {
  customer_support: [
    { trigger_type: "manual", label: "Manual", description: "Launch the assistant manually from the operator panel." },
    { trigger_type: "new_website_message", label: "New website message", description: "Runs when a new website chat message arrives." },
    { trigger_type: "returning_visitor", label: "Returning visitor", description: "Runs when a returning visitor reopens the conversation." },
    { trigger_type: "escalation_requested", label: "Escalation requested", description: "Runs when the assistant should escalate to a human." },
    { trigger_type: "knowledge_gap", label: "Knowledge gap", description: "Runs when the assistant cannot answer from the current support playbook." },
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
  linkedin: [
    { trigger_type: "manual", label: "Manual", description: "Launch the LinkedIn action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Publishes content from a daily queue." },
    { trigger_type: "new_comment", label: "New comment", description: "Runs when a LinkedIn post receives a new comment." },
    { trigger_type: "new_lead", label: "New lead", description: "Runs when LinkedIn activity creates a lead candidate." },
    { trigger_type: "campaign_window", label: "Campaign window", description: "Runs when a LinkedIn campaign period starts." },
  ],
  youtube: [
    { trigger_type: "manual", label: "Manual", description: "Launch the YouTube action manually." },
    { trigger_type: "schedule_daily", label: "Daily schedule", description: "Uploads or stages video work from a queue." },
    { trigger_type: "new_comment", label: "New comment", description: "Runs when a video receives a new comment." },
    { trigger_type: "live_chat_message", label: "Live chat message", description: "Runs when a live chat message is received." },
  ],
  telegram: [
    { trigger_type: "manual", label: "Manual", description: "Launch the Telegram action manually." },
    { trigger_type: "new_message", label: "New message", description: "Runs when a Telegram bot receives a message." },
    { trigger_type: "follow_up_due", label: "Follow-up due", description: "Runs when a Telegram follow-up is due." },
    { trigger_type: "handoff_requested", label: "Handoff requested", description: "Runs when the conversation should escalate." },
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
    allowed_action_types: ["reply_dm", "reply_message", "send_message", "send_dm", "send_template", "send_media", "send_broadcast", "answer_chat", "schedule_appointment", "suggest_article", "capture_ticket", "capture_lead", "handoff_agent"],
    config_fields: [
      {
        key: "mediaPermission",
        label: "Media permitida",
        options: [
          { value: "text_only", label: "Solo texto" },
          { value: "text_and_images", label: "Texto e imagenes" },
          { value: "text_images_video", label: "Texto, imagenes y video" },
          { value: "text_audio", label: "Texto y grabaciones de audio" },
          { value: "text_images_audio", label: "Texto, imagenes y grabaciones" },
          { value: "text_images_video_audio", label: "Texto, imagenes, video y grabaciones" },
          { value: "all_media", label: "Texto, imagenes, video, archivos y grabaciones" },
        ],
      },
    ],
  },
  {
    agent_type: "comment_responder",
    label: "Responder comentarios",
    description: "Agente para replies públicos, moderación y detección de intención.",
    allowed_action_types: ["reply_comment", "reply_mention", "reply_live_chat"],
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
    allowed_action_types: ["publish_post", "publish_story", "publish_reel", "publish_video", "upload_video", "send_email", "send_sequence", "send_media", "send_broadcast"],
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
          { value: "after_review", label: "Despues de revision" },
          { value: "automatic", label: "Automaticamente" },
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
          { value: "daily_budget", label: "Presupuesto diario" },
          { value: "campaign_total", label: "Total de campana" },
          { value: "hard_cap", label: "Limite maximo sin exceder" },
        ],
      },
      {
        key: "campaignDuration",
        label: "Duracion",
        options: [
          { value: "fixed_dates", label: "Fecha de inicio y fin" },
          { value: "always_on", label: "Siempre activa" },
          { value: "launch_sprint", label: "Sprint de lanzamiento" },
        ],
      },
      {
        key: "audienceMode",
        label: "Audiencia",
        options: [
          { value: "interest_geo_demo", label: "Intereses, ubicacion y edad" },
          { value: "retargeting", label: "Retargeting" },
          { value: "lookalike", label: "Lookalike" },
        ],
      },
      {
        key: "conversionGoal",
        label: "Conversion",
        options: [
          { value: "lead", label: "Lead" },
          { value: "purchase", label: "Compra" },
          { value: "message", label: "Mensaje" },
          { value: "appointment", label: "Reserva de cita" },
          { value: "download", label: "Descarga" },
        ],
      },
      {
        key: "creativeMode",
        label: "Creativos permitidos",
        options: [
          { value: "image", label: "Imagen" },
          { value: "video", label: "Video" },
          { value: "carousel", label: "Carrusel" },
          { value: "story_reel", label: "Story/Reel" },
          { value: "mixed", label: "Imagen, video o carrusel" },
        ],
      },
      {
        key: "approvalMode",
        label: "Aprobacion de cambios",
        options: [
          { value: "after_review", label: "Despues de revision" },
          { value: "automatic", label: "Automaticamente" },
          { value: "recommend_only", label: "Solo recomendar" },
        ],
      },
      {
        key: "optimizationRule",
        label: "Reglas de optimizacion",
        options: [
          { value: "pause_high_cpa", label: "Pausar si sube el CPA" },
          { value: "increase_budget_low_cpl", label: "Subir presupuesto si baja el CPL" },
          { value: "rotate_low_ctr", label: "Cambiar creativo si baja el CTR" },
        ],
      },
      {
        key: "trackingEvent",
        label: "Pixel/evento",
        options: [
          { value: "Lead", label: "Lead" },
          { value: "Purchase", label: "Purchase" },
          { value: "Schedule", label: "Schedule" },
          { value: "ViewContent", label: "ViewContent" },
        ],
      },
      {
        key: "reportCadence",
        label: "Reporte",
        options: [
          { value: "daily", label: "Resumen diario" },
          { value: "weekly", label: "Resumen semanal" },
          { value: "on_anomaly", label: "Solo si detecta anomalia" },
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
