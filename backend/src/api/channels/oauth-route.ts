import { buildMetaOAuthStartUrl, completeMetaOAuthCallback } from "../../modules/channels/oauth.js";

export function getMetaOAuthStartUrl(input: {
  channel: string;
  organizationId: string;
  redirectUri: string;
}) {
  return buildMetaOAuthStartUrl(input);
}

export async function handleMetaOAuthCallback(input: {
  code: string;
  state: string;
  redirectUri: string;
}) {
  return completeMetaOAuthCallback(input);
}
