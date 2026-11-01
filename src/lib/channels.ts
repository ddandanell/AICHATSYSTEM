/**
 * Channel adapters for inbound client messages.
 * Purpose: keep GHL, WhatsApp Business, and manual intake as pluggable kinds
 * so the desk stays channel-agnostic. WhatsApp is not implemented yet — only
 * reserved here so future wiring does not fork the inbox.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/architecture.md
 * Do not auto-send on any channel.
 */

export const CHANNEL_KINDS = [
  { id: "ghl", label: "GoHighLevel", status: "receive_stub" as const },
  { id: "whatsapp_business", label: "WhatsApp Business", status: "planned" as const },
  { id: "manual", label: "Manual", status: "active" as const },
] as const;

export type ChannelKind = (typeof CHANNEL_KINDS)[number]["id"];

export function isChannelKind(value: string): value is ChannelKind {
  return CHANNEL_KINDS.some((channel) => channel.id === value);
}

export function channelLabel(value: string | null | undefined): string {
  const hit = CHANNEL_KINDS.find((channel) => channel.id === value);
  return hit?.label ?? value ?? "Channel";
}
