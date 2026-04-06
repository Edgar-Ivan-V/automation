/**
 * FILE: src/modules/voice/twilio.ts
 *
 * Integración directa con la API REST de Twilio. Contiene toda la
 * lógica de comunicación con Twilio, aislada del resto del módulo.
 *
 * Responsabilidades:
 *   - Leer y exponer la configuración de Twilio desde variables de entorno
 *   - Crear llamadas salientes via API REST de Twilio (no SDK)
 *   - Verificar la firma HMAC-SHA1 de los webhooks entrantes de Twilio
 *     (X-Twilio-Signature) para garantizar autenticidad
 *   - Construir URLs absolutas de webhooks a partir de TWILIO_WEBHOOK_BASE_URL
 *
 * Exports:
 *   - getTwilioConfig(): lee y normaliza las vars de entorno de Twilio
 *   - isTwilioConfigured(): true si accountSid + authToken + baseUrl presentes
 *   - createTwilioCall(input): hace POST a Twilio Calls API y retorna el SID
 *   - verifyTwilioSignature(url, params, signature): valida firma del webhook
 *   - buildAbsoluteWebhookUrl(path): construye URL pública para los webhooks
 */

import { createHmac } from "crypto";
import { ValidationError } from "../shared/errors.js";

export interface TwilioCallRequest {
  to: string;
  from: string;
  url: string;
  statusCallback: string;
  recordingStatusCallback?: string;
}

export function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const defaultFromNumber = process.env.TWILIO_FROM_NUMBER;
  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  return {
    accountSid: accountSid?.trim() ?? "",
    authToken: authToken?.trim() ?? "",
    defaultFromNumber: defaultFromNumber?.trim() ?? "",
    baseUrl: baseUrl?.replace(/\/+$/, "") ?? ""
  };
}

export function isTwilioConfigured() {
  const config = getTwilioConfig();
  return Boolean(config.accountSid && config.authToken && config.baseUrl);
}

export async function createTwilioCall(input: TwilioCallRequest) {
  const config = getTwilioConfig();

  if (!config.accountSid || !config.authToken) {
    throw new ValidationError("Twilio credentials are not configured.");
  }

  const body = new URLSearchParams();
  body.set("To", input.to);
  body.set("From", input.from || config.defaultFromNumber);
  body.set("Url", input.url);
  body.set("Method", "POST");
  body.append("StatusCallbackEvent", "initiated");
  body.append("StatusCallbackEvent", "ringing");
  body.append("StatusCallbackEvent", "answered");
  body.append("StatusCallbackEvent", "completed");
  body.set("StatusCallback", input.statusCallback);
  body.set("StatusCallbackMethod", "POST");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const json = (await response.json()) as { sid?: string; status?: string; message?: string; code?: number };
  if (!response.ok || !json.sid) {
    throw new ValidationError(json.message ?? "Twilio call creation failed.");
  }

  return json;
}

export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null) {
  const config = getTwilioConfig();

  if (!config.authToken || !signature) {
    return false;
  }

  const payload = `${url}${Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("")}`;
  const expected = createHmac("sha1", config.authToken).update(payload).digest("base64");
  return expected === signature;
}

export function buildAbsoluteWebhookUrl(path: string) {
  const config = getTwilioConfig();
  if (!config.baseUrl) {
    throw new ValidationError("TWILIO_WEBHOOK_BASE_URL or APP_BASE_URL is required.");
  }

  return `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
