/**
 * FILE: src/api/webhooks/twilio/twiml/gather/route.ts
 *
 * Procesa la tecla DTMF que el contacto presionó durante la llamada.
 * Twilio llama a este endpoint después del <Gather> del TwiML principal
 * con el dígito capturado en el campo "Digits" del body.
 *
 * Mapea el dígito al outcome del flow:
 *   - success_key (ej: "1") → outcome "confirmed"
 *   - secondary_key (ej: "2") → outcome "callback"
 *   - fallback_key (ej: "3") → outcome "not_interested"
 *   - sin input / dígito no reconocido → outcome "no_response"
 *
 * Seguridad: verifica la firma HMAC-SHA1. Si inválida → <Hangup/>.
 * Responde con TwiML de confirmación: "Thank you. We registered <outcome>."
 */

// POST /api/webhooks/twilio/voice/twiml/gather?jobId=<uuid>
// Twilio posts here with the digit the caller pressed.
import { completeCallJobFromGather, getCallConversationContext, processAiCallTurn, verifyTwilioSignature } from "../../../../../modules/voice/index.js";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function handleGather(
  jobId: string,
  requestUrl: string,
  payload: Record<string, string>,
  signature: string | null
): Promise<string> {
  const isValid = verifyTwilioSignature(requestUrl, payload, signature);
  if (!isValid) return "<Response><Hangup/></Response>";

  const context = await getCallConversationContext(jobId);
  console.info("[voice.gather] inbound", {
    jobId,
    mode: context.flow.mode ?? "dtmf",
    digits: payload.Digits ?? null,
    speechResult: payload.SpeechResult ?? null,
    confidence: payload.Confidence ?? null,
    callSid: payload.CallSid ?? null,
    from: payload.From ?? null,
    to: payload.To ?? null,
  });

  if ((context.flow.mode ?? "dtmf") === "ai") {
    const result = await processAiCallTurn({
      jobId,
      digits: payload.Digits ?? null,
      speechResult: payload.SpeechResult ?? null,
    });

    const voice = escapeXml(String(result.agent.voice ?? "alice"));
    const language = escapeXml(String(result.agent.language ?? "es-MX"));
    const message = escapeXml(result.reply);

    console.info("[voice.gather] ai.result", {
      jobId,
      shouldHangup: result.shouldHangup,
      outcome: result.job.outcome ?? null,
      reply: result.reply,
      transcript: result.job.transcript ?? null,
    });

    if (result.shouldHangup) {
      return `<Response><Say voice="${voice}" language="${language}">${message}</Say><Hangup/></Response>`;
    }

    const action = escapeXml(requestUrl);
    return `<Response><Gather input="speech dtmf" speechTimeout="auto" action="${action}" method="POST"><Say voice="${voice}" language="${language}">${message}</Say></Gather><Say voice="${voice}" language="${language}">No escuché una respuesta. Hasta luego.</Say><Hangup/></Response>`;
  }

  const result = await completeCallJobFromGather({
    jobId,
    digits: payload.Digits ?? null,
    speechResult: payload.SpeechResult ?? null,
  });

  console.info("[voice.gather] dtmf.result", {
    jobId,
    outcome: result.job.outcome ?? null,
    transcript: result.job.transcript ?? null,
  });

  return `<Response><Say>Thank you. We registered ${result.job.outcome ?? "your response"}.</Say><Hangup/></Response>`;
}
