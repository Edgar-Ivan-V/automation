/**
 * FILE: src/api/webhooks/twilio/status/route.ts
 *
 * Webhook recibido desde Twilio cuando cambia el estado de una llamada.
 * Twilio lo llama múltiples veces durante el ciclo de vida:
 *   initiated → ringing → answered → completed (o busy/failed/no-answer)
 *
 * Seguridad: verifica la firma HMAC-SHA1 en X-Twilio-Signature antes
 * de procesar. Si la firma es inválida, lanza error (responde 500 a Twilio).
 *
 * Al recibir "completed": actualiza el CallJob con duración, answeredBy
 * y recording URL si está disponible.
 * Twilio espera una respuesta 2xx; si no la recibe, reintenta el webhook.
 */

// POST /api/webhooks/twilio/voice/status
// Twilio calls this endpoint to report call status changes.
// Verify the X-Twilio-Signature header before processing.
import { handleTwilioCallStatus, verifyTwilioSignature } from "../../../../modules/voice/index.js";

export async function handleStatusWebhook(
  requestUrl: string,
  payload: Record<string, string>,
  signature: string | null
) {
  const isValid = verifyTwilioSignature(requestUrl, payload, signature);
  if (!isValid) throw new Error("Invalid Twilio signature.");

  return handleTwilioCallStatus({
    callSid: payload.CallSid,
    callStatus: payload.CallStatus,
    answeredBy: payload.AnsweredBy ?? null,
    duration: payload.CallDuration ?? null,
    recordingUrl: payload.RecordingUrl ?? null,
    rawPayload: payload,
  });
}
