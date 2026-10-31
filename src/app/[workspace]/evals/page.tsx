import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceAccess } from "@/lib/context";
import { evalCases } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { excerpt } from "@/lib/format";
import { reasonLabel } from "@/lib/reason-codes";

export const metadata = { title: "Evals" };

export default async function EvalsPage({
  params,
}: PageProps<"/[workspace]/evals">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const rows = await withTenant(access.ctx.orgId, async (tx) => {
    return tx.select().from(evalCases).orderBy(desc(evalCases.createdAt));
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Eval cases</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Golden scenarios live in the table. The regression runner is not part
          of this slice, so nothing here has been executed.
        </p>
      </div>
      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No eval cases</EmptyTitle>
            <EmptyDescription>This workspace has no golden scenarios yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded-xl border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{row.name}</h3>
                <Badge variant="outline">Not run</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{excerpt(row.inboundText, 220)}</p>
              <p className="text-sm">
                Expect {row.expectedDecision ?? "—"} · {reasonLabel(row.expectedReasonCode)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
