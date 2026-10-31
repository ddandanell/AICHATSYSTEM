/**
 * Groups knowledge into bookings, dietary, pricing, staffing, complaints. Do not auto-send.
 */
export const KNOWLEDGE_GROUPS = [
  { id: "bookings", label: "Bookings" },
  { id: "dietary", label: "Dietary" },
  { id: "pricing", label: "Pricing" },
  { id: "staffing", label: "Staffing" },
  { id: "complaints", label: "Complaints" },
] as const;

export type KnowledgeGroup = (typeof KNOWLEDGE_GROUPS)[number]["id"];

const GROUP_IDS = new Set<string>(KNOWLEDGE_GROUPS.map((group) => group.id));

const SCOPE_TO_GROUP: Record<string, KnowledgeGroup> = {
  booking: "bookings",
  bookings: "bookings",
  billing: "pricing",
  pricing: "pricing",
  service: "dietary",
  dietary: "dietary",
  operations: "staffing",
  staffing: "staffing",
  complaints: "complaints",
};

export function isKnowledgeGroup(value: string): value is KnowledgeGroup {
  return GROUP_IDS.has(value);
}

export function groupForScope(scope: string | null | undefined): KnowledgeGroup {
  if (!scope) return "bookings";
  return SCOPE_TO_GROUP[scope] ?? "bookings";
}

export function groupLabel(scope: string | null | undefined): string {
  const id = groupForScope(scope);
  return KNOWLEDGE_GROUPS.find((group) => group.id === id)?.label ?? id;
}

export function groupForTitle(title: string, projectId?: string | null): KnowledgeGroup {
  const text = `${title} ${projectId ?? ""}`.toLowerCase();
  if (/pric|billing|invoice|deposit|menu/.test(text)) return "pricing";
  if (/diet|allerg/.test(text)) return "dietary";
  if (/staff|tone|voice|hiring/.test(text)) return "staffing";
  if (/complain|refund|angry/.test(text)) return "complaints";
  return groupForScope(projectId);
}
