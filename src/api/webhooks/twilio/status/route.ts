// POST /api/webhooks/twilio/voice/status
// Twilio calls this endpoint to report call status changes.
// Verify the X-Twilio-Signature header before processing.
import { handleTwilioCallStatus, verifyTwilioSignature } from "../../../modules/voice";

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
