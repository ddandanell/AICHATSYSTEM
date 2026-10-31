import Link from "next/link";
import { sql } from "drizzle-orm";
import { dashboardCounts, listInbox, listKnowledgeDrafts } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { documents } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { getWorkspaceAccess } from "@/lib/context";
import { excerpt } from "@/lib/format";
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
  const recent = usesMychefInbox() ? await listInbox("pending_review", 1) : null;
  const drafts = usesMychefInbox() ? await listKnowledgeDrafts() : [];
  const groups = drafts.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.group] = (acc[doc.group] ?? 0) + 1;
    return acc;
  }, {});

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
      {Object.keys(groups).length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Knowledge groups</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(groups).map(([group, count]) => (
              <Link
                key={group}
                href={`/${access.ctx.orgSlug}/knowledge?group=${group}`}
                className="rounded-full border px-3 py-1 text-sm"
              >
                {group} · {count}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {recent && recent.rows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Newest conversations that need a reply</h3>
          <ul className="flex flex-col gap-2">
            {recent.rows.slice(0, 6).map((row) => (
              <li key={row.id}>
                <Link href={`/${access.ctx.orgSlug}/inbox/${row.id}`} className="text-sm">
                  <span className="font-medium">{row.name ?? "Contact"}</span>
                  <span className="text-muted-foreground"> · {excerpt(row.inbound ?? "No inbound text", 90)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Link
        href={`/${access.ctx.orgSlug}/inbox`}
        className={cn(buttonVariants({ variant: "default" }), "w-fit")}
      >
        Open all {counts.needsReply} waiting conversations
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
