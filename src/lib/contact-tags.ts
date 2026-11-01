/**
 * Contact tag helpers stored in mychef_inbox.contacts.facts (jsonb).
 * Purpose: category pills and tag-scoped re-draft without new DDL.
 * Changing a tag should re-fetch knowledge and regenerate the draft
 * (see inbox-ux.md Client Info + CBLS tag routing).
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */

export const CATEGORY_TAGS = [
  { id: "private_chef", label: "Private Chef", match: /private\s*chef|chef/i, tone: "blue" as const },
  { id: "catering", label: "Catering", match: /cater/i, tone: "purple" as const },
  { id: "vip", label: "VIP", match: /\bvip\b/i, tone: "gold" as const },
] as const;

export type CategoryTagId = (typeof CATEGORY_TAGS)[number]["id"];

export type ContactFacts = {
  tags?: string[];
  phone?: string;
  email?: string;
  address?: string;
  [key: string]: unknown;
};

export function parseFacts(raw: unknown): ContactFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ContactFacts;
}

export function tagsFromFacts(facts: ContactFacts): string[] {
  if (!Array.isArray(facts.tags)) return [];
  return facts.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
}

export function categoriesFromTags(tags: string[]): CategoryTagId[] {
  const joined = tags.join(" ");
  return CATEGORY_TAGS.filter((item) => item.match.test(joined) || tags.some((tag) => item.match.test(tag))).map(
    (item) => item.id,
  );
}

export function withTags(facts: ContactFacts, tags: string[]): ContactFacts {
  const cleaned = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return { ...facts, tags: cleaned };
}
