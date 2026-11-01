/**
 * Server composer for the myCHEF three-pane desk.
 * Purpose: load queue (pane 1) and selected conversation or empty workspace.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import Link from "next/link";
import { DeskReview } from "@/components/inbox/desk-review";
import { DeskShell } from "@/components/inbox/desk-shell";
import { QueuePane } from "@/components/inbox/queue-pane";
import { buttonVariants } from "@/components/ui/button";
import {
  getConversation,
  getRecordedDecision,
  listDeskQueue,
  listStoredKnowledge,
  type DeskFilter,
} from "@/data/mychef-store";
import { outcomeAction } from "@/app/[workspace]/inbox/mychef-actions";
import { Badge } from "@/components/ui/badge";
import { OUTCOMES, decisionLabel, reasonLabel } from "@/lib/reason-codes";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

function parseFilter(value: string | undefined): DeskFilter {
  if (value === "all" || value === "auto_sent" || value === "escalated" || value === "needs_review") {
    return value;
  }
  return "needs_review";
}

export async function MychefDesk({
  slug,
  selectedId,
  filterRaw,
  page,
  search,
}: {
  slug: string;
  selectedId?: string;
  filterRaw?: string;
  page: number;
  search: string;
}) {
  const filter = parseFilter(filterRaw);
  const inbox = await listDeskQueue(filter, page, search);
  const ids = inbox.rows.filter((row) => row.kind === "conversation").map((row) => row.id);
  const activeId = selectedId ?? null;
  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const nextId = activeIndex >= 0 ? ids[activeIndex + 1] ?? null : ids[0] ?? null;

  let workspace: React.ReactNode = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h2 className="text-lg font-medium tracking-tight">Pick a conversation</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The left queue is waiting replies. Open one to see history, the AI draft, and why.
        Nothing sends from this desk.
      </p>
    </div>
  );

  if (activeId) {
    const recorded = await getRecordedDecision(activeId).catch(() => null);
    if (recorded) {
      const action = outcomeAction.bind(null, recorded.id);
      workspace = (
        <article className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 lg:px-6">
          <div className="flex flex-wrap gap-2">
            <Badge>
              {decisionLabel(
                recorded.human_decision === "approved" ? "accepted" : recorded.human_decision,
              )}
            </Badge>
            <Badge variant="outline">{reasonLabel(recorded.reason_code)}</Badge>
            {recorded.contact_name ? <Badge variant="secondary">{recorded.contact_name}</Badge> : null}
          </div>
          <blockquote className="rounded-lg border bg-muted/50 px-4 py-3 text-sm whitespace-pre-wrap">
            {recorded.inbound ?? "No inbound text stored."}
          </blockquote>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Draft</dt>
              <dd className="whitespace-pre-wrap">{recorded.original_draft}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Final</dt>
              <dd className="whitespace-pre-wrap">{recorded.edited_draft}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Why</dt>
              <dd className="whitespace-pre-wrap">{recorded.rationale}</dd>
            </div>
          </dl>
          <form action={action} className="flex max-w-md flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="outcome">
              Outcome
            </label>
            <select
              id="outcome"
              name="outcome"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              required
            >
              {OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" className="w-fit">
              Save outcome
            </Button>
          </form>
          <Link href={`/${slug}/inbox`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}>
            Back to queue
          </Link>
        </article>
      );
    } else {
      const conversation = await getConversation(activeId);
      if (conversation) {
        const knowledge = await listStoredKnowledge();
        const titles = Object.fromEntries(knowledge.map((doc) => [doc.id, doc.title]));
        workspace = (
          <DeskReview
            slug={slug}
            nextId={nextId}
            knowledgeTitles={titles}
            conversation={{
              id: conversation.id,
              contact_name: conversation.contact_name,
              status: conversation.status,
              channel: conversation.channel,
              tags: conversation.tags,
              categories: conversation.categories,
              facts: {
                phone: typeof conversation.facts.phone === "string" ? conversation.facts.phone : undefined,
                email: typeof conversation.facts.email === "string" ? conversation.facts.email : undefined,
                address:
                  typeof conversation.facts.address === "string" ? conversation.facts.address : undefined,
              },
              messages: conversation.messages,
              draft: conversation.draft
                ? {
                    body: conversation.draft.body,
                    model: conversation.draft.model,
                    sources: conversation.draft.sources,
                    confidence: conversation.draft.confidence,
                    why: conversation.draft.why,
                    whyNot: conversation.draft.whyNot,
                  }
                : null,
            }}
          />
        );
      }
    }
  }

  return (
    <DeskShell
      slug={slug}
      ids={ids}
      activeId={activeId}
      queue={
        <QueuePane
          slug={slug}
          filter={filter}
          search={search}
          rows={inbox.rows}
          activeId={activeId}
          total={inbox.total}
          page={inbox.page}
          pageSize={inbox.pageSize}
        />
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">{workspace}</div>
    </DeskShell>
  );
}
