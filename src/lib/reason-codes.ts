/**
 * Review reason codes and human decisions. Do not auto-send.
 */
export const REASON_CODES = [
  { code: "wrong_policy", label: "Wrong policy" },
  { code: "wrong_fact", label: "Wrong fact" },
  { code: "too_formal", label: "Too formal" },
  { code: "too_casual", label: "Too casual" },
  { code: "missed_upsell", label: "Missed upsell" },
  { code: "should_have_asked", label: "Should have asked" },
  { code: "customer_angry", label: "Customer is angry" },
  { code: "needs_human", label: "Needs a human" },
  { code: "missing_knowledge", label: "Missing knowledge" },
  { code: "irrelevant_source", label: "Irrelevant source" },
  { code: "good_as_drafted", label: "Good as drafted" },
] as const;

export type ReasonCode = (typeof REASON_CODES)[number]["code"];

const codes = new Set<string>(REASON_CODES.map((item) => item.code));

export function isReasonCode(value: string): value is ReasonCode {
  return codes.has(value);
}

export function reasonLabel(code: string | null | undefined): string {
  return REASON_CODES.find((item) => item.code === code)?.label ?? code ?? "—";
}

export const HUMAN_DECISIONS = [
  { value: "accepted", label: "Accepted" },
  { value: "edited", label: "Edited" },
  { value: "rejected", label: "Rejected" },
  { value: "escalated", label: "Escalated" },
] as const;

export type HumanDecision = (typeof HUMAN_DECISIONS)[number]["value"];

export function isHumanDecision(value: string): value is HumanDecision {
  return HUMAN_DECISIONS.some((item) => item.value === value);
}

export function decisionLabel(value: string | null | undefined): string {
  return HUMAN_DECISIONS.find((item) => item.value === value)?.label ?? value ?? "—";
}

export const OUTCOMES = [
  "booked",
  "closed",
  "refunded",
  "no_response",
  "complaint",
  "ongoing",
] as const;

export type Outcome = (typeof OUTCOMES)[number];
