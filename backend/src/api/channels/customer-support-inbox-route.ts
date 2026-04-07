import {
  getCustomerSupportInboxSession,
  listCustomerSupportInboxSessions,
  sendCustomerSupportInboxReply,
  updateCustomerSupportInboxSession,
} from "../../modules/channels/index.js";
import type {
  SendCustomerSupportInboxReplyInput,
  UpdateCustomerSupportInboxSessionInput,
} from "../../modules/channels/index.js";

export async function getCustomerSupportInboxSessionsRoute(
  organizationId: string,
  query: { accountId?: string; limit: number; offset: number }
) {
  return listCustomerSupportInboxSessions({
    organizationId,
    accountId: query.accountId,
    pagination: { limit: query.limit, offset: query.offset },
  });
}

export async function getCustomerSupportInboxSessionRoute(organizationId: string, sessionId: string) {
  return getCustomerSupportInboxSession(organizationId, sessionId);
}

export async function postCustomerSupportInboxReplyRoute(
  organizationId: string,
  sessionId: string,
  body: Omit<SendCustomerSupportInboxReplyInput, "organizationId" | "sessionId">
) {
  return sendCustomerSupportInboxReply({ organizationId, sessionId, ...body });
}

export async function patchCustomerSupportInboxSessionRoute(
  organizationId: string,
  sessionId: string,
  body: Omit<UpdateCustomerSupportInboxSessionInput, "organizationId" | "sessionId">
) {
  return updateCustomerSupportInboxSession({ organizationId, sessionId, ...body });
}
