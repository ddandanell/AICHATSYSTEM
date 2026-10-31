export const GHL_CHANNEL = "ghl" as const;
export const WHATSAPP_CHANNEL = "whatsapp" as const;

/** WhatsApp Business is a future adapter. The route is not built. */
export const whatsappInboundReady = false;

export type InboundChannel = typeof GHL_CHANNEL | typeof WHATSAPP_CHANNEL;

export type InboundMessage = {
  channel: InboundChannel;
  body: string;
  contactId: string;
  contactName: string;
  conversationId: string;
  messageId: string;
  locationId: string;
};

export function inboundFromGhl(parsed: {
  body: string;
  contactId: string;
  contactName: string;
  conversationId: string;
  messageId: string;
  locationId: string;
}): InboundMessage {
  return {
    channel: GHL_CHANNEL,
    body: parsed.body,
    contactId: parsed.contactId,
    contactName: parsed.contactName,
    conversationId: parsed.conversationId,
    messageId: parsed.messageId,
    locationId: parsed.locationId,
  };
}

export function channelAdapterLabel(channel: string | null | undefined): string {
  const value = (channel ?? "").trim();
  if (!value) return "Unknown";
  if (value.toLowerCase() === WHATSAPP_CHANNEL) return "WhatsApp";
  if (value.toLowerCase() === GHL_CHANNEL) return "GoHighLevel";
  return value;
}
