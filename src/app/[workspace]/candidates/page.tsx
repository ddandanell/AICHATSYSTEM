import { desc } from "drizzle-orm";
import { knowledgeStatusAction, learnAction, learnPassAction, ruleStatusAction } from "@/app/[workspace]/ledger-actions";
import { listKnowledgeDrafts, listRuleCandidates } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { rules } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceAccess } from "@/lib/context";
import { canReview } from "@/lib/workspace-access";

export const metadata = { title: "Candidates" };

export default async function CandidatesPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/candidates">) {
  const { workspace } = await params;
  const query = await searchParams;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const neon = usesMychefInbox();
  const rows = neon
    ? await listRuleCandidates()
    : await withTenant(access.ctx.orgId, async (tx) => {
        return tx.select().from(rules).orderBy(desc(rules.createdAt));
      });
  const learn = learnAction.bind(null, access.ctx.orgSlug);
  const pass = learnPassAction.bind(null, access.ctx.orgSlug);
  const clustered = typeof query.clustered === "string" ? query.clustered : "";
  const update = ruleStatusAction.bind(null, access.ctx.orgSlug);
  const knowledge = neon ? await listKnowledgeDrafts() : [];
  const mark = knowledgeStatusAction.bind(null, access.ctx.orgSlug);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium tracking-tight">Learning queue</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            A reviewer runs the loop. It writes candidates only. Good-as-drafted does not become a rule. Nothing activates itself, and nothing is sent.
          </p>
        </div>
        {canReview(access.ctx.role) ? (
          <div className="flex flex-wrap gap-2">
            <form action={pass}>
              <Button type="submit">Run learning pass</Button>
            </form>
            <form action={learn}>
              <Button type="submit" variant="outline">Run learning loop</Button>
            </form>
          </div>
        ) : null}
      </div>
      {clustered ? (
        <p className="max-w-2xl text-sm text-muted-foreground">
          Clustered {clustered} recent reasons and proposed {typeof query.proposed === "string" ? query.proposed : "0"} pending rows. Nothing was activated and nothing was sent.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No candidate rules</EmptyTitle>
            <EmptyDescription>
              Record a few reviews, then run the loop. The other workspace cannot see these rows.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((rule) => {
            const statement = "statement" in rule ? rule.statement : rule.title;
            const evidence =
              "evidenceCount" in rule
                ? rule.evidenceCount
                : evidenceFrom(rule.content);
            const status = rule.status === "pending" ? "candidate" : rule.status === "approved" ? "active" : rule.status === "retired" ? "deprecated" : rule.status;
            const group = "category" in rule ? rule.category : "scope" in rule ? rule.scope : "";
            return (
              <li key={rule.id} className="flex flex-col gap-3 rounded-xl border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{status}</Badge>
                  <Badge variant="outline">{queueGroup(String(group))}</Badge>
                  <span className="text-sm text-muted-foreground">evidence {evidence}</span>
                </div>
                <p className="text-sm">{statement}</p>
                {"content" in rule ? caseDiff(rule.content) : null}
                {canReview(access.ctx.role) && status === "candidate" ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={update}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="status" value={neon ? "approved" : "active"} />
                      <Button type="submit" size="sm" variant="outline">
                        Approve snippet
                      </Button>
                    </form>
                    <form action={update}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="status" value={neon ? "retired" : "deprecated"} />
                      <Button type="submit" size="sm" variant="ghost">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {neon ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Knowledge drafts</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            These are the existing knowledge rows. Approving or retiring changes status only. The row stays in the table.
          </p>
          <ul className="flex flex-col gap-3">
            {knowledge.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-3 rounded-xl border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{doc.group}</Badge>
                  <Badge variant="secondary">{doc.status}</Badge>
                </div>
                <p className="text-sm">{doc.title}</p>
                {canReview(access.ctx.role) ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={mark}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm" variant="outline">
                        Approve
                      </Button>
                    </form>
                    <form action={mark}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="status" value="retired" />
                      <Button type="submit" size="sm" variant="ghost">
                        Retire
                      </Button>
                    </form>
                    {doc.status !== "pending" ? (
                      <form action={mark}>
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="status" value="pending" />
                        <Button type="submit" size="sm" variant="ghost">
                          Return to pending
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function queueGroup(category: string) {
  if (["missing_knowledge", "wrong_fact", "wrong_policy", "knowledge_gap"].includes(category)) {
    return "Missing knowledge";
  }
  if (["too_formal", "too_casual", "should_have_asked", "customer_angry", "procedure_gap"].includes(category)) {
    return "Tone";
  }
  if (["irrelevant_source", "retrieval"].includes(category)) return "Outdated";
  return "Suggested";
}

function caseDiff(content: string) {
  const ai = content.split("AI draft:")[1]?.split("Human reply:")[0]?.trim();
  const human = content.split("Human reply:")[1]?.trim();
  if (!ai && !human) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {ai ? <p className="text-muted-foreground line-through whitespace-pre-wrap">{ai}</p> : null}
      {human ? <p className="whitespace-pre-wrap">{human}</p> : null}
    </div>
  );
}

function evidenceFrom(content: string): string {
  const match = content.match(/evidence:\s*(\d+)/);
  return match?.[1] ?? "—";
}
