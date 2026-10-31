export function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatConfidence(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const number = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(number)) return String(value);
  if (number >= 0 && number <= 1) return `${Math.round(number * 100)}%`;
  return String(number);
}

export function excerpt(text: string, length = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;
  return `${flat.slice(0, length - 1).trimEnd()}…`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function roleLabel(role: string): string {
  if (!role) return role;
  return role.slice(0, 1).toUpperCase() + role.slice(1);
}
