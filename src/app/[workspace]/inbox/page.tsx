/**
 * Inbox queue. Neon uses the three-pane cockpit. Do not auto-send.
 */
import Link from "next/link";
import { draftAction } from "@/app/[workspace]/inbox/actions";
import { DraftComposer } from "@/components/draft-composer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  approveInboxAction,
  regenerateInboxAction,
  retagInboxAction,
} from "@/app/[workspace]/inbox/cockpit-actions";
import { InboxCockpit, type InboxSelection } from "@/components/inbox-cockpit";
import { listInboxBoard, type InboxFilter } from "@/data/inbox-board";
import { getConversation } from "@/data/mychef-store";
import { draftMeta, tagsFromFacts } from "@/lib/inbox-tags";
import { readAutopilot } from "@/lib/autopilot";
import { usesMychefInbox } from "@/db/mode";
import { getWorkspaceAccess } from "@/lib/context";
import { listDecisions } from "@/lib/decisions";
import { excerpt, formatConfidence, formatWhen } from "@/lib/format";
import { decisionLabel, reasonLabel } from "@/lib/reason-codes";
import { canReview } from "@/lib/workspace-access";

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
  if (usesMychefInbox()) {
    const search = typeof query.q === "string" ? query.q : "";
    const filter = isFilter(query.filter) ? query.filter : "needs_review";
    const selectedId = typeof query.id === "string" ? query.id : "";
    const tagged = typeof query.tagged === "string" ? query.tagged : "";
    const items = await listInboxBoard(search, filter);
    const autopilot = await readAutopilot();
    const conversation = selectedId ? await getConversation(selectedId) : null;
    const selected = conversation ? toSelection(conversation) : null;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {autopilot.enabled
            ? "Sending is not connected."
            : "Auto-pilot is off. A draft stays pending until you approve it."}
        </p>
        <InboxCockpit
          slug={access.ctx.orgSlug}
          filter={filter}
          query={search}
          items={items}
          selected={selected}
          canReview={canReview(access.ctx.role)}
          tagged={tagged}
          approveAction={approveInboxAction.bind(null, access.ctx.orgSlug)}
          regenerateAction={regenerateInboxAction.bind(null, access.ctx.orgSlug)}
          retagAction={retagInboxAction.bind(null, access.ctx.orgSlug)}
        />
      </div>
    );
  }
  const rows = await listDecisions(access.ctx.orgId, status);
  const draft = draftAction.bind(null, access.ctx.orgSlug);

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
      {status === "pending_review" ? (
        canReview(access.ctx.role) ? (
          <DraftComposer action={draft} />
        ) : (
          <Alert>
            <AlertTitle>View only</AlertTitle>
            <AlertDescription>
              Your role can read this queue. A reviewer, admin, or owner pastes a message to draft a reply.
            </AlertDescription>
          </Alert>
        )
      ) : null}
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

function isFilter(value: string | string[] | undefined): value is InboxFilter {
  return value === "all" || value === "needs_review" || value === "auto_sent" || value === "escalated";
}

function toSelection(
  conversation: NonNullable<Awaited<ReturnType<typeof getConversation>>>,
): InboxSelection {
  const meta = draftMeta(conversation.draft?.prompt_version);
  const inbound = [...conversation.messages].reverse().find((message) => message.direction === "inbound")?.body ?? "";
  const rawSources = Array.isArray(conversation.draft?.source_ids) ? conversation.draft.source_ids : [];
  const sources = rawSources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const row = source as { id?: unknown; title?: unknown };
    if (typeof row.id !== "string" || typeof row.title !== "string") return [];
    return [{ id: row.id, title: row.title }];
  });
  return {
    id: conversation.id,
    name: conversation.contact_name ?? "Guest",
    channel: conversation.channel ?? "",
    tags: tagsFromFacts(conversation.facts, inbound),
    contactId: conversation.contact_id,
    phone: typeof conversation.facts?.phone === "string" ? conversation.facts.phone : null,
    email: typeof conversation.facts?.email === "string" ? conversation.facts.email : null,
    address: typeof conversation.facts?.address === "string" ? conversation.facts.address : null,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      body: message.body,
      at: message.created_at.toISOString(),
    })),
    draft: conversation.draft?.body ?? "",
    confidence: meta.confidence,
    why: meta.why,
    sources,
    decided: conversation.decided,
  };
}
