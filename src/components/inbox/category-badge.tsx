/**
 * Category pills for queue cards and Client Info (Private Chef / Catering / VIP).
 * Pane: queue (1) and context Client Info (3).
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { CATEGORY_TAGS, type CategoryTagId } from "@/lib/contact-tags";
import { cn } from "cn";

const TONE: Record<(typeof CATEGORY_TAGS)[number]["tone"], string> = {
  blue: "border-sky-300/80 bg-sky-50 text-sky-900",
  purple: "border-violet-300/80 bg-violet-50 text-violet-900",
  gold: "border-amber-300/80 bg-amber-50 text-amber-950",
};

export function CategoryBadge({ id }: { id: CategoryTagId }) {
  const item = CATEGORY_TAGS.find((entry) => entry.id === id);
  if (!item) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        TONE[item.tone],
      )}
    >
      {item.label}
    </span>
  );
}

export function ConfidenceDot({ confidence }: { confidence: number | null }) {
  if (confidence == null) {
    return <span className="size-2 rounded-full bg-muted-foreground/30" title="No confidence yet" />;
  }
  const high = confidence >= 0.55;
  return (
    <span
      className={cn("size-2 rounded-full", high ? "bg-emerald-500" : "bg-amber-400")}
      title={high ? "High confidence" : "Low confidence"}
    />
  );
}
