import { desc } from "drizzle-orm";
import { learnAction, ruleStatusAction } from "@/app/[workspace]/ledger-actions";
import { listRuleCandidates } from "@/data/mychef-store";
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
}: PageProps<"/[workspace]/candidates">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const neon = usesMychefInbox();
  const rows = neon
    ? await listRuleCandidates()
    : await withTenant(access.ctx.orgId, async (tx) => {
        return tx.select().from(rules).orderBy(desc(rules.createdAt));
      });
  const learn = learnAction.bind(null, access.ctx.orgSlug);
  const update = ruleStatusAction.bind(null, access.ctx.orgSlug);

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
          <form action={learn}>
            <Button type="submit">Run learning loop</Button>
          </form>
        ) : null}
      </div>
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
                  <Badge variant="outline">{group}</Badge>
                  <span className="text-sm text-muted-foreground">evidence {evidence}</span>
                </div>
                <p className="text-sm">{statement}</p>
                {canReview(access.ctx.role) ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={update}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="status" value={neon ? "approved" : "active"} />
                      <Button type="submit" size="sm" variant="outline">
                        Activate
                      </Button>
                    </form>
                    <form action={update}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="status" value={neon ? "retired" : "deprecated"} />
                      <Button type="submit" size="sm" variant="ghost">
                        Deprecate
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function evidenceFrom(content: string): string {
  const match = content.match(/evidence:\s*(\d+)/);
  return match?.[1] ?? "—";
}
