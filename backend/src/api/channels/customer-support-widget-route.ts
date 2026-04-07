import {
  createCustomerSupportWidgetSession,
  getCustomerSupportWidgetConfig,
  getCustomerSupportWidgetSession,
  requestCustomerSupportHandoff,
  sendCustomerSupportWidgetMessage,
} from "../../modules/channels/index.js";
import type {
  CreateCustomerSupportWidgetSessionInput,
  RequestCustomerSupportHandoffInput,
  SendCustomerSupportWidgetMessageInput,
} from "../../modules/channels/index.js";

export async function getCustomerSupportWidgetConfigRoute(publicWidgetKey: string, origin?: string, sourceUrl?: string) {
  return getCustomerSupportWidgetConfig(publicWidgetKey, origin, sourceUrl);
}

export async function postCustomerSupportWidgetSessionRoute(body: CreateCustomerSupportWidgetSessionInput) {
  return createCustomerSupportWidgetSession(body);
}

export async function getCustomerSupportWidgetSessionRoute(sessionId: string, origin?: string) {
  return getCustomerSupportWidgetSession(sessionId, origin);
}

export async function postCustomerSupportWidgetMessageRoute(sessionId: string, body: Omit<SendCustomerSupportWidgetMessageInput, "sessionId">) {
  return sendCustomerSupportWidgetMessage({ sessionId, ...body });
}

export async function postCustomerSupportWidgetHandoffRoute(sessionId: string, body: Omit<RequestCustomerSupportHandoffInput, "sessionId">) {
  return requestCustomerSupportHandoff({ sessionId, ...body });
}
