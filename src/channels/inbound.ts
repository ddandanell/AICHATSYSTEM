/**
 * Channel ingress seam for Inbox mychef.
 *
 * GHL is live today. WhatsApp Business is a planned adapter that must map onto
 * the same conversation → message → draft → review → ledger loop.
 * Do not auto-send. Do not call WhatsApp APIs from this module yet.
 *
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */

export const GHL_CHANNEL = "ghl" as const;
export const WHATSAPP_CHANNEL = "whatsapp" as const;

export type InboundChannel = typeof GHL_CHANNEL | typeof WHATSAPP_CHANNEL;

/** Flip when a WhatsApp Business adapter is wired. Keep false until then. */
export const whatsappInboundReady = false;

export type InboundMessage = {
  channel: InboundChannel;
  body: string;
  contactId: string;
  contactName: string;
  conversationId: string;
  messageId: string;
  locationId?: string;
  receivedAt?: string;
};

export function isInboundChannel(value: string): value is InboundChannel {
  return value === GHL_CHANNEL || value === WHATSAPP_CHANNEL;
}

export function channelLabel(channel: InboundChannel): string {
  if (channel === WHATSAPP_CHANNEL) return "WhatsApp Business";
  return "GoHighLevel";
}
