/**
 * Contact response time strip — Started / Waiting / avg replies / Last activity.
 * Purpose: always-visible SLA context above the thread (no DDL).
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/contact-response-desk.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md
 */
import { ClockIcon } from "lucide-react";
import type { ContactResponseMetrics, WaitingTone } from "@/lib/contact-response";
import { cn } from "cn";

function waitingClass(tone: WaitingTone): string {
  if (tone === "urgent") return "text-destructive";
  if (tone === "warn") return "text-foreground";
  if (tone === "calm") return "text-foreground";
  return "text-muted-foreground";
}

function Metric({
  label,
  value,
  title,
  valueClassName,
}: {
  label: string;
  value: string;
  title?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-sm font-medium", valueClassName)} title={title}>
        {value}
      </span>
    </div>
  );
}

export function TimeStrip({ metrics }: { metrics: ContactResponseMetrics }) {
  return (
    <div className="border-b border-border bg-background px-4 py-4 lg:px-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5" />
          <span>Response clock · Asia/Kuala_Lumpur</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Started" value={metrics.startedLabel} />
          <Metric
            label="Waiting"
            value={metrics.waitingLabel}
            title={metrics.waitingAbsolute}
            valueClassName={waitingClass(metrics.waitingTone)}
          />
          <Metric
            label="Your avg reply"
            value={metrics.yourAvgReplyLabel}
            title={metrics.averagesHint ?? undefined}
          />
          <Metric
            label="Guest avg reply"
            value={metrics.guestAvgReplyLabel}
            title={metrics.averagesHint ?? undefined}
          />
          <Metric
            label="Last activity"
            value={metrics.lastActivityLabel}
            title={metrics.lastActivityAt?.toISOString()}
          />
        </div>
        {metrics.averagesHint ? (
          <p className="text-xs text-muted-foreground">{metrics.averagesHint}</p>
        ) : null}
      </div>
    </div>
  );
}
