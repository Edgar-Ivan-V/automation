/**
 * FILE: src/modules/shared/env.ts
 *
 * Valida las variables de entorno al arrancar el servidor usando Zod.
 * Si falta alguna variable requerida (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
 * el proceso termina inmediatamente con un mensaje descriptivo en lugar
 * de fallar silenciosamente más adelante.
 *
 * Se llama una sola vez al inicio de server.ts, antes de definir rutas.
 *
 * Variables requeridas:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Variables opcionales:
 *   - DEV_BYPASS_AUTH, DEV_BYPASS_USER_ID (solo desarrollo)
 *   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
 *     TWILIO_WEBHOOK_BASE_URL (voz desactivada si no están)
 *   - INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET
 *   - FACEBOOK_ACCESS_TOKEN, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
 *   - MESSENGER_ACCESS_TOKEN, MESSENGER_PAGE_ID
 *   - WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID
 *   - X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *   - TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_ACCESS_TOKEN
 *   - EMAIL_FROM, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS
 *   - PORT (default 3005)
 */

import fs from "fs";
import path from "path";
import { z } from "zod";

const optionalPositiveIntFromEnv = z.preprocess((value) => {
  if (value === "" || value == null) {
    return undefined;
  }
  return value;
}, z.coerce.number().int().positive().optional());

const envSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  DEV_BYPASS_AUTH: z.enum(["true", "false"]).optional(),
  DEV_BYPASS_USER_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().optional(),
  OPENAI_REALTIME_VOICE: z.string().optional(),
  OPENAI_REALTIME_TRANSCRIBE_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().optional(),
  OPENROUTER_HTTP_REFERER: z.string().optional(),
  OPENROUTER_X_TITLE: z.string().optional(),
  // Instagram
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  // Facebook
  FACEBOOK_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  // Messenger
  MESSENGER_ACCESS_TOKEN: z.string().optional(),
  MESSENGER_PAGE_ID: z.string().optional(),
  // WhatsApp Business
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  // X (Twitter)
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  // TikTok
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  // Email (SMTP)
  EMAIL_FROM: z.string().optional(),
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: optionalPositiveIntFromEnv,
  EMAIL_SMTP_USER: z.string().optional(),
  EMAIL_SMTP_PASS: z.string().optional(),
  PORT: optionalPositiveIntFromEnv,
});

export type Env = z.infer<typeof envSchema>;

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function validateEnv(): Env {
  loadDotEnvFile();
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[env] Missing or invalid environment variables:\n${messages}`);
    process.exit(1);
  }
  return result.data;
}
