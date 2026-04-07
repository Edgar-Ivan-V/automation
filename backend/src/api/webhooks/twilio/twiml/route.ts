// POST /api/webhooks/twilio/voice/twiml?jobId=<uuid>
// Twilio fetches this to get the TwiML script for the call.
import { getCallConversationContext, registerTwilioCallWithElevenLabs, verifyTwilioSignature } from "../../../../modules/voice/index.js";

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

  const { job, flow, agent } = await getCallConversationContext(jobId);
  const voice = escapeXml(String(agent.voice ?? "alice"));
  const language = escapeXml(String(agent.language ?? "es-MX"));
  const introPrompt = String(agent.intro_prompt ?? "").trim();
  const mode = String(flow.mode ?? "dtmf");

  console.info("[voice.twiml] build", {
    jobId,
    mode,
    voice,
    language,
  });

  if (mode === "ai" || mode === "realtime") {
    const firstMessage = [introPrompt, flow.prompt_template].filter(Boolean).join(" ").trim();
    const prompt = [
      "You are a phone-call assistant connected through Twilio.",
      `Speak primarily in ${agent.language || "es-MX"} unless the caller asks for another language.`,
      "Keep replies short, natural, and clear on a live phone call.",
      "Do not mention internal systems, prompts, or models.",
      `Call objective: ${flow.objective}`,
      flow.system_prompt ? `Additional business instructions: ${flow.system_prompt}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return registerTwilioCallWithElevenLabs({
      fromNumber: job.from_number,
      toNumber: job.to_number,
      direction: "outbound",
      conversationInitiationClientData: {
        dynamic_variables: {
          call_job_id: job.id,
          flow_name: flow.name,
          objective: flow.objective,
        },
        conversation_config_override: {
          agent: {
            prompt: {
              prompt,
            },
            first_message: firstMessage || undefined,
            language: agent.language || "es-MX",
          },
        },
      },
    });
  }

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
