import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewAction } from "@/app/[workspace]/inbox/[id]/actions";
import { FeedbackForm } from "@/components/feedback-form";
import { RetrievalPanel } from "@/components/retrieval-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MychefThread } from "@/app/[workspace]/inbox/thread";
import { usesMychefInbox } from "@/db/mode";
import { getWorkspaceAccess } from "@/lib/context";
import { getDecision } from "@/lib/decisions";
import { formatConfidence, formatWhen } from "@/lib/format";
import { listKnowledge } from "@/lib/knowledge";
import { retrieveForDecision } from "@/lib/retrieval";
import { decisionLabel, reasonLabel } from "@/lib/reason-codes";
import { canReview } from "@/lib/workspace-access";

export const metadata = { title: "Draft" };

export default async function DecisionPage({
  params,
}: PageProps<"/[workspace]/inbox/[id]">) {
  const { workspace, id } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  if (usesMychefInbox()) {
    const thread = await MychefThread({ id });
    if (!thread) notFound();
    return thread;
  }
  const decision = await getDecision(access.ctx.orgId, id);
  if (!decision) notFound();
  const catalog = listKnowledge().map((doc) => ({ id: doc.id, title: doc.title }));
  const action = reviewAction.bind(null, access.ctx.orgSlug, decision.id);
  const retrieval = await retrieveForDecision(
    access.ctx.orgId,
    decision.id,
    `${decision.inboundBody}\n${decision.draftText}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${access.ctx.orgSlug}/inbox`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back to queue
        </Link>
        <Badge variant={decision.status === "reviewed" ? "secondary" : "default"}>
          {decision.status === "reviewed" ? "Reviewed" : "Pending"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatConfidence(decision.confidence)} confidence · {formatWhen(decision.receivedAt)}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Inbound</h2>
          <p className="text-xs text-muted-foreground">Immutable. The raw message is not editable.</p>
          <blockquote className="rounded-lg border bg-card px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
            {decision.inboundBody}
          </blockquote>
          <h2 className="text-sm font-medium">Draft</h2>
          <div className="rounded-lg border px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
            {decision.draftText}
          </div>
          {decision.status === "pending_review" && decision.rationale ? (
            <dl className="grid gap-3 rounded-lg border px-4 py-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Why</dt>
                <dd className="whitespace-pre-wrap">{decision.rationale}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Why not</dt>
                <dd className="whitespace-pre-wrap">{decision.whyNot}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Escalate</dt>
                <dd>
                  {decision.actionTaken === "escalate"
                    ? "Yes. A person should take this. Nothing is sent."
                    : "No. A reviewer can accept, edit, or reject the draft. Nothing is sent."}
                </dd>
              </div>
            </dl>
          ) : null}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Cited sources</h2>
            {(decision.sourceRefs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None cited.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {decision.sourceRefs.map((source) => (
                  <li key={source.id}>
                    <Badge variant="outline">{source.title}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="flex flex-col gap-4">
          {decision.status === "reviewed" ? (
            <div className="flex flex-col gap-4 rounded-xl border p-4">
              <h2 className="text-sm font-medium">Recorded decision</h2>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Decision</dt>
                  <dd>{decisionLabel(decision.humanDecision)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{reasonLabel(decision.reasonCode)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Why this reply</dt>
                  <dd className="whitespace-pre-wrap">{decision.rationale}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Why not the alternative</dt>
                  <dd className="whitespace-pre-wrap">{decision.whyNot}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Final text</dt>
                  <dd className="whitespace-pre-wrap">{decision.finalText ?? "Nothing was sent."}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd>{decision.outcome ?? "Not recorded yet."}</dd>
                </div>
              </dl>
              {decision.feedback.map((event) => (
                <div key={event.id} className="flex flex-col gap-2 border-t pt-3 text-sm">
                  <p className="text-muted-foreground">Source marks</p>
                  <ul className="flex flex-wrap gap-2">
                    {(event.sourceMarks ?? []).length === 0 ? (
                      <li>None</li>
                    ) : (
                      event.sourceMarks.map((mark) => (
                        <li key={`${mark.id}-${mark.mark}`}>
                          <Badge variant="outline">
                            {mark.id} · {mark.mark}
                          </Badge>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : canReview(access.ctx.role) ? (
            <>
              <a href="#review-form" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
                I don’t like the way this is written.
              </a>
            <FeedbackForm
              action={action}
              draft={decision.draftText}
              sources={decision.sourceRefs ?? []}
              catalog={catalog}
            />
            </>
          ) : (
            <Alert>
              <AlertTitle>View only</AlertTitle>
              <AlertDescription>
                Your role can read this draft. A reviewer, admin, or owner records the decision.
              </AlertDescription>
            </Alert>
          )}
        </section>
      </div>
      <RetrievalPanel
        workspace={access.ctx.orgSlug}
        decisions={retrieval.decisions}
        knowledge={retrieval.knowledge}
      />
    </div>
  );
}
