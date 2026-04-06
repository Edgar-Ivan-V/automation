/**
 * FILE: src/api/webhooks/twilio/twiml/route.ts
 *
 * Genera el XML TwiML que Twilio lee al contacto durante la llamada.
 * Twilio llama a este endpoint al conectar la llamada para obtener
 * las instrucciones de qué decir y qué hacer.
 *
 * El TwiML generado usa <Gather> para capturar una tecla DTMF:
 *   - Intro prompt del agente (opcional)
 *   - Prompt del flow con la pregunta principal
 *   - Instrucciones de teclas ("Press 1 for confirmed, Press 2 for callback…")
 *   - Timeout de 6 segundos antes de colgar
 *
 * Seguridad: verifica la firma HMAC-SHA1 en X-Twilio-Signature.
 * Si la firma es inválida, responde con <Response><Say>Unauthorized.</Say></Response>.
 *
 * El gatherActionUrl apunta al handler de gather (siguiente webhook).
 */

// POST /api/webhooks/twilio/voice/twiml?jobId=<uuid>
// Twilio fetches this to get the TwiML script for the call.
import { requireServiceSupabaseClient, ValidationError } from "../../../../modules/shared/index.js";
import { buildTwilioRealtimeStreamUrl, verifyTwilioSignature } from "../../../../modules/voice/index.js";

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
      "flow:call_flows(*), agent:call_agents(voice, language, intro_prompt)"
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
  const mode = String(flow.mode ?? "dtmf");

  console.info("[voice.twiml] build", {
    jobId,
    mode,
    voice,
    language,
  });

  if (mode === "realtime") {
    const streamUrl = escapeXml(buildTwilioRealtimeStreamUrl(jobId));
    return `<Response><Connect><Stream url="${streamUrl}"><Parameter name="jobId" value="${escapeXml(jobId)}" /></Stream></Connect></Response>`;
  }

  if (mode === "ai") {
    const prompt = escapeXml(
      [
        introPrompt,
        flow.prompt_template,
        "Puedes responder hablando naturalmente o usar el teclado.",
      ]
        .filter(Boolean)
        .join(" ")
    );
    const action = escapeXml(gatherActionUrl);
    return `<Response><Gather input="speech dtmf" speechTimeout="auto" action="${action}" method="POST"><Say voice="${voice}" language="${language}">${prompt}</Say></Gather><Say voice="${voice}" language="${language}">No escuché una respuesta. Hasta luego.</Say><Hangup/></Response>`;
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
