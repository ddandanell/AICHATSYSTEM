/**
 * Private Chef, Catering, and VIP tags stored on contacts.facts. Do not auto-send.
 */
export const INBOX_TAGS = [
  { id: "private_chef", label: "Private Chef" },
  { id: "catering", label: "Catering" },
  { id: "vip", label: "VIP" },
] as const;

export type InboxTag = (typeof INBOX_TAGS)[number]["id"];

const IDS = new Set<string>(INBOX_TAGS.map((tag) => tag.id));

export function isInboxTag(value: string): value is InboxTag {
  return IDS.has(value);
}

export function tagLabel(id: string): string {
  return INBOX_TAGS.find((tag) => tag.id === id)?.label ?? id;
}

export function tagsFromFacts(facts: { tags?: unknown } | null | undefined, text: string): InboxTag[] {
  const stored = Array.isArray(facts?.tags) ? facts.tags.filter((tag): tag is InboxTag => typeof tag === "string" && isInboxTag(tag)) : [];
  if (stored.length > 0) return stored;
  const guessed: InboxTag[] = [];
  if (/cater|banquet|corporate|wedding/i.test(text)) guessed.push("catering");
  if (/\bvip\b/i.test(text)) guessed.push("vip");
  if (guessed.length === 0) guessed.push("private_chef");
  return guessed;
}

export function draftMeta(prompt: string | null | undefined): {
  confidence: number | null;
  why: string;
  escalate: boolean;
} {
  if (!prompt) return { confidence: null, why: "", escalate: false };
  try {
    const parsed = JSON.parse(prompt) as { confidence?: unknown; why?: unknown; escalate?: unknown };
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : null;
    return {
      confidence,
      why: typeof parsed.why === "string" ? parsed.why : "",
      escalate: parsed.escalate === true,
    };
  } catch {
    return { confidence: null, why: "", escalate: false };
  }
}
