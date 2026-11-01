/**
 * IMC-33 slot: contact timing strip for an open conversation.
 * Drop above the thread; layout chrome stays with the design-system desk.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/contact-response-desk.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { Card, CardContent } from "@/components/ui/card";
import type { ThreadTiming } from "@/lib/thread-timing";
import { cn } from "cn";

const WAITING_TONE: Record<ThreadTiming["waitingTone"], string> = {
  calm: "bg-muted/40",
  warn: "bg-secondary",
  urgent: "bg-destructive/5 ring-destructive/20",
  idle: "bg-card",
};

function Metric({
  label,
  value,
  title,
  hint,
  className,
}: {
  label: string;
  value: string;
  title?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("min-w-[7.5rem] flex-1 py-0 shadow-none ring-1 ring-foreground/10", className)} title={title}>
      <CardContent className="flex flex-col gap-1 px-3 py-2">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-sm font-medium tabular-nums">{value}</p>
        {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function TimeStrip({ timing }: { timing: ThreadTiming }) {
  return (
    <div className="shrink-0 border-b border-border bg-muted/50 p-4">
      <div className="flex flex-wrap gap-2">
        <Metric label="Started" value={timing.startedLabel} title="Asia/Kuala_Lumpur" />
        <Metric
          label="Waiting"
          value={timing.waitingLabel}
          title={timing.waitingAbsolute}
          className={WAITING_TONE[timing.waitingTone]}
        />
        <Metric
          label="Your avg reply"
          value={timing.staffAvgLabel}
          hint={timing.staffAvgMs == null ? "Not enough turns yet." : undefined}
        />
        <Metric
          label="Guest avg reply"
          value={timing.guestAvgLabel}
          hint={timing.guestAvgMs == null ? "Not enough turns yet." : undefined}
        />
        <Metric label="Last activity" value={timing.lastActivityLabel} title={timing.lastActivityAt ?? undefined} />
      </div>
    </div>
  );
}
