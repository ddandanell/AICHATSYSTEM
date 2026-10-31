import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceAccess } from "@/lib/context";
import { withTenant } from "@/db/tenant";
import { rules } from "@/db/schema";

export const metadata = { title: "Candidates" };

export default async function CandidatesPage({
  params,
}: PageProps<"/[workspace]/candidates">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const rows = await withTenant(access.ctx.orgId, async (tx) => {
    return tx.select().from(rules).orderBy(desc(rules.createdAt));
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Candidate rules</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The nightly learning loop is not running. When it does, it writes
          proposals here with status candidate and does not activate them.
        </p>
      </div>
      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No candidate rules</EmptyTitle>
            <EmptyDescription>
              Feedback is being stored. Nothing has been promoted into a rule.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((rule) => (
            <li key={rule.id} className="rounded-xl border px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{rule.status}</Badge>
                <Badge variant="outline">{rule.scope}</Badge>
                <span className="text-sm text-muted-foreground">
                  evidence {rule.evidenceCount}
                </span>
              </div>
              <p className="mt-2 text-sm">{rule.statement}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
