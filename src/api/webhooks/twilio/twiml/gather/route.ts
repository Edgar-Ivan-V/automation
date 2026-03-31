// POST /api/webhooks/twilio/voice/twiml/gather?jobId=<uuid>
// Twilio posts here with the digit the caller pressed.
import { completeCallJobFromGather, verifyTwilioSignature } from "../../../../modules/voice";

export async function handleGather(
  jobId: string,
  requestUrl: string,
  payload: Record<string, string>,
  signature: string | null
): Promise<string> {
  const isValid = verifyTwilioSignature(requestUrl, payload, signature);
  if (!isValid) return "<Response><Hangup/></Response>";

  const result = await completeCallJobFromGather({
    jobId,
    digits: payload.Digits ?? null,
    speechResult: payload.SpeechResult ?? null,
  });

  return `<Response><Say>Thank you. We registered ${result.job.outcome ?? "your response"}.</Say><Hangup/></Response>`;
}
