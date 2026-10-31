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
}: {
  slug: string;
  status: "pending_review" | "reviewed";
}) {
  const rows = await listInbox(status);
  const waiting = status === "pending_review" ? Number(rows[0] && "waiting" in rows[0] ? rows[0].waiting : rows.length) : rows.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium tracking-tight">Review queue</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Conversations that still need a reply, taken from the existing message store.
            {status === "pending_review" && waiting > rows.length
              ? ` Showing ${rows.length} of ${waiting}.`
              : ""}{" "}
            Automatic sending is not on.
          </p>
        </div>
        <QueueTabs slug={slug} status={status} />
      </div>
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
    </div>
  );
}
