/**
 * Inbox route loading — skeleton for the three-pane desk.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row" aria-busy="true" aria-label="Loading inbox">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-border bg-muted/50 p-4 lg:w-80 lg:border-r">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
        <div className="flex flex-col gap-4 pt-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="hidden min-h-0 flex-1 flex-col gap-4 p-6 lg:flex">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-3/4 rounded-lg" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-lg" />
          <Skeleton className="h-16 w-3/4 rounded-lg" />
        </div>
        <Skeleton className="mt-auto h-40 w-full rounded-lg" />
      </div>
      <aside className="hidden w-96 shrink-0 flex-col gap-4 border-l border-border bg-muted/50 p-4 lg:flex">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full" />
      </aside>
    </div>
  );
}
