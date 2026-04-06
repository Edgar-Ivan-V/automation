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

import type { ChannelActionDefinition, ChannelKind } from "./types.js";

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
    { action_type: "send_sequence", label: "Send sequence", content_type: "email", description: "Sends a multi-step follow-up sequence." },
    { action_type: "tag_contact", label: "Tag contact", description: "Adds tags or segments to the recipient." }
  ],
  facebook: [
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment on a Facebook post." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Sends a direct message response." },
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a feed post to Facebook." },
    { action_type: "capture_lead", label: "Capture lead", description: "Creates or updates a lead from a Facebook interaction." }
  ],
  instagram: [
    { action_type: "publish_post", label: "Publish photo", content_type: "photo", description: "Publishes a photo post to the Instagram feed." },
    { action_type: "publish_story", label: "Publish story", content_type: "story", description: "Publishes a story asset to Instagram stories." },
    { action_type: "publish_reel", label: "Publish reel", content_type: "video", description: "Publishes a video reel to Instagram." },
    { action_type: "reply_dm", label: "Reply DM", content_type: "message", description: "Replies to an Instagram direct message." }
  ],
  x: [
    { action_type: "publish_post", label: "Publish post", content_type: "post", description: "Publishes a post on X." },
    { action_type: "reply_mention", label: "Reply mention", content_type: "reply", description: "Replies to a mention or thread." },
    { action_type: "send_dm", label: "Send DM", content_type: "message", description: "Sends a direct message on X." }
  ],
  tiktok: [
    { action_type: "publish_video", label: "Publish video", content_type: "video", description: "Publishes a TikTok video asset." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a TikTok comment." },
    { action_type: "capture_lead", label: "Capture lead", description: "Captures a lead from profile or campaign traffic." }
  ],
  whatsapp: [
    { action_type: "send_template", label: "Send template", content_type: "template", description: "Sends a WhatsApp template message." },
    { action_type: "reply_message", label: "Reply message", content_type: "message", description: "Replies to a WhatsApp conversation." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Escalates a conversation to a human operator." }
  ],
  messenger: [
    { action_type: "send_message", label: "Send message", content_type: "message", description: "Sends a Messenger message." },
    { action_type: "reply_comment", label: "Reply comment", content_type: "comment", description: "Replies to a comment from a Messenger-linked source." },
    { action_type: "handoff_agent", label: "Handoff human", description: "Transfers a conversation to a human operator." }
  ]
};

export function isSupportedChannel(value: string): value is ChannelKind {
  return SUPPORTED_CHANNELS.includes(value as ChannelKind);
}
