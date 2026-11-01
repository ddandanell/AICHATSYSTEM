/**
 * Conversation timing metrics for the contact response desk top strip.
 * Purpose: started, waiting, staff/guest avg reply, last activity — no DDL.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/contact-response-desk.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */

export type TimingMessage = {
  direction: string;
  created_at: Date | string;
};

export type ThreadTiming = {
  startedAt: string | null;
  startedLabel: string;
  waitingMs: number | null;
  waitingLabel: string;
  waitingAbsolute: string;
  waitingTone: "calm" | "warn" | "urgent" | "idle";
  waitingOnGuest: boolean;
  staffAvgMs: number | null;
  staffAvgLabel: string;
  guestAvgMs: number | null;
  guestAvgLabel: string;
  lastActivityAt: string | null;
  lastActivityLabel: string;
};

const ZONE = "Asia/Kuala_Lumpur";

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAbsoluteKl(value: Date | string | null | undefined): string {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDurationShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 48) return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function replyGaps(messages: TimingMessage[], after: "inbound" | "outbound"): number[] {
  const ordered = [...messages]
    .map((row) => ({
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      at: asDate(row.created_at),
    }))
    .filter((row): row is { direction: "inbound" | "outbound"; at: Date } => Boolean(row.at))
    .sort((left, right) => left.at.getTime() - right.at.getTime());

  const gaps: number[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (!current || current.direction !== after) continue;
    const nextDirection = after === "inbound" ? "outbound" : "inbound";
    for (let look = index + 1; look < ordered.length; look += 1) {
      const candidate = ordered[look];
      if (!candidate) continue;
      if (candidate.direction === current.direction) break;
      if (candidate.direction === nextDirection) {
        gaps.push(candidate.at.getTime() - current.at.getTime());
        break;
      }
    }
  }
  return gaps;
}

export function computeThreadTiming(
  messages: TimingMessage[],
  lastMessageAt: Date | string | null | undefined,
  now = new Date(),
  contactFallback?: TimingMessage[],
): ThreadTiming {
  const ordered = [...messages]
    .map((row) => ({
      direction: row.direction === "outbound" ? "outbound" : "inbound",
      at: asDate(row.created_at),
    }))
    .filter((row): row is { direction: "inbound" | "outbound"; at: Date } => Boolean(row.at))
    .sort((left, right) => left.at.getTime() - right.at.getTime());

  const firstInbound = ordered.find((row) => row.direction === "inbound")?.at ?? ordered[0]?.at ?? null;
  const last = ordered[ordered.length - 1] ?? null;
  const lastActivity = asDate(lastMessageAt) ?? last?.at ?? null;

  let waitingMs: number | null = null;
  let waitingOnGuest = false;
  if (last) {
    waitingMs = Math.max(0, now.getTime() - last.at.getTime());
    waitingOnGuest = last.direction === "outbound";
  }

  let staffAvgMs = mean(replyGaps(messages, "inbound"));
  let guestAvgMs = mean(replyGaps(messages, "outbound"));
  if (staffAvgMs == null && contactFallback?.length) {
    staffAvgMs = mean(replyGaps(contactFallback, "inbound"));
  }
  if (guestAvgMs == null && contactFallback?.length) {
    guestAvgMs = mean(replyGaps(contactFallback, "outbound"));
  }

  let waitingTone: ThreadTiming["waitingTone"] = "idle";
  if (!waitingOnGuest && waitingMs != null) {
    const hours = waitingMs / 3_600_000;
    waitingTone = hours < 4 ? "calm" : hours <= 24 ? "warn" : "urgent";
  }

  return {
    startedAt: firstInbound?.toISOString() ?? null,
    startedLabel: formatAbsoluteKl(firstInbound),
    waitingMs,
    waitingLabel: waitingOnGuest
      ? `Waiting on guest · ${formatDurationShort(waitingMs)}`
      : formatDurationShort(waitingMs),
    waitingAbsolute: formatAbsoluteKl(last?.at ?? null),
    waitingTone,
    waitingOnGuest,
    staffAvgMs,
    staffAvgLabel: staffAvgMs == null ? "—" : formatDurationShort(staffAvgMs),
    guestAvgMs,
    guestAvgLabel: guestAvgMs == null ? "—" : formatDurationShort(guestAvgMs),
    lastActivityAt: lastActivity?.toISOString() ?? null,
    lastActivityLabel: formatAbsoluteKl(lastActivity),
  };
}
