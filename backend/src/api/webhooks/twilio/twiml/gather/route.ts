// POST /api/webhooks/twilio/voice/twiml/gather?jobId=<uuid>
// Twilio posts here with the digit the caller pressed.
import { completeCallJobFromGather, getCallConversationContext, verifyTwilioSignature } from "../../../../../modules/voice/index.js";

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

  if ((context.flow.mode ?? "dtmf") === "ai" || (context.flow.mode ?? "dtmf") === "realtime") {
    return "<Response><Hangup/></Response>";
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
