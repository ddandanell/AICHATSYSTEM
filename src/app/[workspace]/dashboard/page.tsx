import Link from "next/link";
import { sql } from "drizzle-orm";
import { dashboardCounts } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { documents } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { getWorkspaceAccess } from "@/lib/context";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  params,
}: PageProps<"/[workspace]/dashboard">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const counts = usesMychefInbox()
    ? await dashboardCounts()
    : await localCounts(access.ctx.orgId);

  const cards = [
    { label: "Waiting for review", value: counts.needsReply, href: `/${access.ctx.orgSlug}/inbox` },
    { label: "Recorded decisions", value: counts.decisions, href: `/${access.ctx.orgSlug}/inbox?status=reviewed` },
    { label: "Knowledge", value: counts.knowledge, href: `/${access.ctx.orgSlug}/knowledge` },
    { label: "Contacts", value: counts.contacts, href: `/${access.ctx.orgSlug}/inbox` },
    { label: "Messages", value: counts.messages, href: `/${access.ctx.orgSlug}/inbox` },
    { label: "Candidate rules", value: counts.candidates, href: `/${access.ctx.orgSlug}/candidates` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">{access.ctx.orgName}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The ledger sits on the existing contacts, messages, and knowledge. Nothing is sent from this console.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label}>
            <Link href={card.href} className="block">
              <Card>
                <CardHeader>
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle>{card.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={`/${access.ctx.orgSlug}/inbox`}
        className={cn(buttonVariants({ variant: "default" }), "w-fit")}
      >
        Open the review queue
      </Link>
    </div>
  );
}

async function localCounts(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const decisions = await tx.execute(
      sql`select count(*) filter (where status = 'pending_review')::int as pending,
             count(*)::int as total
          from decision_records`,
    );
    const knowledge = await tx.select({ id: documents.id }).from(documents);
    const row = decisions.rows[0] as { pending?: number; total?: number } | undefined;
    return {
      needsReply: Number(row?.pending ?? 0),
      decisions: Number(row?.total ?? 0),
      knowledge: knowledge.length,
      contacts: 0,
      messages: 0,
      candidates: 0,
    };
  });
}
