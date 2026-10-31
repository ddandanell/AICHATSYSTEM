import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { QueueTabs } from "@/components/queue-tabs";
import { getWorkspaceAccess } from "@/lib/context";
import { listDecisions } from "@/lib/decisions";
import { excerpt, formatConfidence, formatWhen } from "@/lib/format";
import { decisionLabel, reasonLabel } from "@/lib/reason-codes";

export const metadata = { title: "Inbox" };

export default async function InboxPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/inbox">) {
  const { workspace } = await params;
  const query = await searchParams;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const status = query.status === "reviewed" ? "reviewed" : "pending_review";
  const rows = await listDecisions(access.ctx.orgId, status);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium tracking-tight">Review queue</h2>
          <p className="text-sm text-muted-foreground">
            Inbound text stays as it arrived. You record what should have been sent.
          </p>
        </div>
        <QueueTabs slug={access.ctx.orgSlug} status={status} />
      </div>
      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {status === "pending_review" ? "Nothing is waiting" : "No reviewed decisions"}
            </EmptyTitle>
            <EmptyDescription>
              {status === "pending_review"
                ? "New drafts land here. Nothing sends on its own."
                : "Accepted, edited, rejected, and escalated replies show up here with their reason."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/${access.ctx.orgSlug}/inbox/${row.id}`} className="block">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatConfidence(row.confidence)} confidence</Badge>
                      {row.humanDecision ? (
                        <Badge variant="secondary">{decisionLabel(row.humanDecision)}</Badge>
                      ) : (
                        <Badge>Pending</Badge>
                      )}
                      {row.reasonCode ? (
                        <Badge variant="outline">{reasonLabel(row.reasonCode)}</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatWhen(row.receivedAt)}
                      </span>
                    </div>
                    <CardTitle>{excerpt(row.inboundBody, 140)}</CardTitle>
                    <CardDescription>{excerpt(row.draftText, 180)}</CardDescription>
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
