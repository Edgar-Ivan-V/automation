import crypto from "crypto";
import { ValidationError } from "../shared/errors.js";
import { createChannelAccount } from "./services.js";
import type { ChannelKind } from "./types.js";

type MetaOAuthChannel = Extract<ChannelKind, "facebook" | "instagram" | "messenger" | "whatsapp">;

interface OAuthStatePayload {
  channel: MetaOAuthChannel;
  organizationId: string;
  nonce: string;
  issuedAt: number;
}

interface MetaProfile {
  id?: string;
  name?: string;
}

const metaOAuthChannels = new Set<MetaOAuthChannel>(["facebook", "instagram", "messenger", "whatsapp"]);
const defaultScopes: Record<MetaOAuthChannel, string> = {
  facebook: "public_profile,pages_show_list,pages_read_engagement",
  instagram: "public_profile,instagram_basic,pages_show_list",
  messenger: "public_profile,pages_show_list,pages_messaging",
  whatsapp: "public_profile,whatsapp_business_management,whatsapp_business_messaging",
};

function asMetaOAuthChannel(value: string): MetaOAuthChannel {
  if (!metaOAuthChannels.has(value as MetaOAuthChannel)) {
    throw new ValidationError("OAuth login is only configured for facebook, instagram, messenger, and whatsapp.");
  }
  return value as MetaOAuthChannel;
}

function getMetaAppConfig(channel: MetaOAuthChannel) {
  const idKey = channel === "instagram" ? "INSTAGRAM_APP_ID" : "FACEBOOK_APP_ID";
  const secretKey = channel === "instagram" ? "INSTAGRAM_APP_SECRET" : "FACEBOOK_APP_SECRET";
  const appId = process.env[idKey]?.trim();
  const appSecret = process.env[secretKey]?.trim();

  if (!appId || !appSecret) {
    throw new ValidationError(`${idKey} and ${secretKey} are required to connect ${channel} with login.`);
  }

  return { appId, appSecret };
}

function getMetaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || "v20.0";
}

function getMetaOAuthScopes(channel: MetaOAuthChannel) {
  const channelKey = `${channel.toUpperCase()}_OAUTH_SCOPES`;
  return process.env[channelKey]?.trim() || process.env.META_OAUTH_SCOPES?.trim() || defaultScopes[channel];
}

function getStateSecret() {
  return process.env.META_OAUTH_STATE_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

function signStatePayload(payload: string) {
  const secret = getStateSecret();
  if (!secret) throw new ValidationError("META_OAUTH_STATE_SECRET is required for social OAuth state signing.");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeState(payload: OAuthStatePayload) {
  const serialized = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${serialized}.${signStatePayload(serialized)}`;
}

function decodeState(state: string): OAuthStatePayload {
  const [serialized, signature] = state.split(".");
  if (!serialized || !signature) throw new ValidationError("OAuth state is invalid.");

  const expectedSignature = signStatePayload(serialized);
  if (signature.length !== expectedSignature.length) {
    throw new ValidationError("OAuth state signature is invalid.");
  }
  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    throw new ValidationError("OAuth state signature is invalid.");
  }

  const payload = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as OAuthStatePayload;
  const maxAgeMs = 15 * 60 * 1000;
  if (!payload.issuedAt || Date.now() - payload.issuedAt > maxAgeMs) {
    throw new ValidationError("OAuth state expired. Start the login again.");
  }

  payload.channel = asMetaOAuthChannel(payload.channel);
  return payload;
}

export function buildMetaOAuthStartUrl(input: {
  channel: string;
  organizationId: string;
  redirectUri: string;
}) {
  const channel = asMetaOAuthChannel(input.channel);
  const { appId } = getMetaAppConfig(channel);
  const state = encodeState({
    channel,
    organizationId: input.organizationId,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  });

  const url = new URL(`https://www.facebook.com/${getMetaGraphApiVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", getMetaOAuthScopes(channel));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

async function fetchMetaJson<T>(url: URL) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null) as T & { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new ValidationError(data?.error?.message || "Meta OAuth request failed.");
  }
  return data as T;
}

export async function completeMetaOAuthCallback(input: {
  code: string;
  state: string;
  redirectUri: string;
}) {
  const state = decodeState(input.state);
  const { appId, appSecret } = getMetaAppConfig(state.channel);
  const version = getMetaGraphApiVersion();

  const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
  tokenUrl.searchParams.set("code", input.code);

  const token = await fetchMetaJson<{ access_token: string; token_type?: string; expires_in?: number }>(tokenUrl);
  if (!token.access_token) throw new ValidationError("Meta did not return an access token.");

  const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
  profileUrl.searchParams.set("fields", "id,name");
  profileUrl.searchParams.set("access_token", token.access_token);
  const profile = await fetchMetaJson<MetaProfile>(profileUrl);

  const name = profile.name || `${state.channel} account`;
  const account = await createChannelAccount({
    organizationId: state.organizationId,
    channel: state.channel,
    name,
    handle: profile.id ? `${state.channel}:${profile.id}` : state.channel,
    provider: "meta_oauth",
    externalAccountId: profile.id,
    status: "connected",
    metadata: {
      oauth: {
        provider: "meta",
        channel: state.channel,
        tokenType: token.token_type ?? "bearer",
        accessToken: token.access_token,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
        scopes: getMetaOAuthScopes(state.channel).split(",").map((scope) => scope.trim()).filter(Boolean),
        connectedAt: new Date().toISOString(),
      },
      profile,
    },
  });

  return account;
}
