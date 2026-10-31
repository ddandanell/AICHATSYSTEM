/**
 * Neon queue list. Tables: conversations, contacts, decision_records. Do not auto-send.
 */
import Link from "next/link";
import { listInbox } from "@/data/mychef-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { QueueTabs } from "@/components/queue-tabs";
import { excerpt, formatWhen } from "@/lib/format";
import { decisionLabel, reasonLabel } from "@/lib/reason-codes";

export async function MychefQueue({
  slug,
  status,
  page,
  search,
}: {
  slug: string;
  status: "pending_review" | "reviewed";
  page: number;
  search: string;
}) {
  const inbox = await listInbox(status, page, search);
  const { rows, total, pageSize } = inbox;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(inbox.page, pages);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium tracking-tight">Review queue</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {total} conversation{total === 1 ? "" : "s"}
            {status === "pending_review" ? " still need a reply." : " have a recorded decision."}{" "}
            Page {current} of {pages}. Automatic sending is not on.
          </p>
        </div>
        <QueueTabs slug={slug} status={status} />
      </div>
      <form className="flex flex-wrap gap-2" action={`/${slug}/inbox`}>
        {status === "reviewed" ? <input type="hidden" name="status" value="reviewed" /> : null}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by contact name"
          className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <button type="submit" className="h-9 rounded-md border px-3 text-sm">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {status === "pending_review" ? "Nothing is waiting" : "No reviewed decisions"}
            </EmptyTitle>
            <EmptyDescription>
              {status === "pending_review"
                ? "When a conversation needs a reply, it shows up here. Nothing sends on its own."
                : "Reviewed conversations stay in the ledger."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/${slug}/inbox/${row.id}`} className="block">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      {"name" in row && row.name ? <Badge variant="secondary">{row.name}</Badge> : null}
                      {"human_decision" in row && row.human_decision ? (
                        <Badge>{decisionLabel(row.human_decision === "approved" ? "accepted" : row.human_decision)}</Badge>
                      ) : (
                        <Badge>Needs reply</Badge>
                      )}
                      {"reason_code" in row && row.reason_code ? (
                        <Badge variant="outline">{reasonLabel(row.reason_code)}</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(
                          "created_at" in row
                            ? row.created_at
                            : "last_message_at" in row
                              ? row.last_message_at
                              : null,
                        )}
                      </span>
                    </div>
                    <CardTitle>{excerpt(row.inbound ?? "No inbound text", 140)}</CardTitle>
                    <CardDescription>{excerpt(row.draft ?? "No draft yet", 180)}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {Array.from({ length: pages }, (_, index) => index + 1).map((number) => {
            const params = new URLSearchParams();
            if (status === "reviewed") params.set("status", "reviewed");
            if (search) params.set("q", search);
            params.set("page", String(number));
            return (
              <Link
                key={number}
                href={`/${slug}/inbox?${params.toString()}`}
                className={
                  number === current
                    ? "rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                    : "rounded-md border px-3 py-1 text-sm"
                }
              >
                {number}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
