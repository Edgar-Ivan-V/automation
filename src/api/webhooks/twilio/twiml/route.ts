// POST /api/webhooks/twilio/voice/twiml?jobId=<uuid>
// Twilio fetches this to get the TwiML script for the call.
import { requireServiceSupabaseClient } from "../../../../modules/shared/index.js";
import { verifyTwilioSignature } from "../../../../modules/voice/index.js";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function buildTwiML(
  jobId: string,
  gatherActionUrl: string,
  requestUrl: string,
  payload: Record<string, string>,
  signature: string | null
): Promise<string> {
  const isValid = verifyTwilioSignature(requestUrl, payload, signature);
  if (!isValid) return "<Response><Say>Unauthorized.</Say><Hangup/></Response>";

  const supabase = requireServiceSupabaseClient();
  const { data, error } = await supabase
    .from("call_jobs")
    .select(
      "flow:call_flows(prompt_template, success_key, success_label, secondary_key, secondary_label, fallback_key, fallback_label), agent:call_agents(voice, language, intro_prompt)"
    )
    .eq("id", jobId)
    .maybeSingle();

  const flowRecord = Array.isArray(data?.flow) ? data?.flow[0] : data?.flow;
  const agentRecord = Array.isArray(data?.agent) ? data?.agent[0] : data?.agent;

  if (error || !flowRecord || !agentRecord) {
    return "<Response><Say>Configuration not found.</Say><Hangup/></Response>";
  }

  const voice = escapeXml(String((agentRecord as any).voice ?? "alice"));
  const language = escapeXml(String((agentRecord as any).language ?? "es-MX"));
  const introPrompt = String((agentRecord as any).intro_prompt ?? "").trim();
  const flow = flowRecord as any;

  const message = escapeXml(
    [
      introPrompt,
      flow.prompt_template,
      `Press ${flow.success_key} for ${flow.success_label}.`,
      `Press ${flow.secondary_key} for ${flow.secondary_label}.`,
      `Press ${flow.fallback_key} for ${flow.fallback_label}.`,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const action = escapeXml(gatherActionUrl);
  return `<Response><Gather input="dtmf" numDigits="1" timeout="6" action="${action}" method="POST"><Say voice="${voice}" language="${language}">${message}</Say></Gather><Say voice="${voice}" language="${language}">We did not receive a response. Goodbye.</Say><Hangup/></Response>`;
}
