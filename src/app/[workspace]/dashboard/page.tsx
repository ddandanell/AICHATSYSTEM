/**
 * Home dashboard after login — clear next steps: Inbox, Knowledge, Keys.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import Link from "next/link";
import { sql } from "drizzle-orm";
import { dashboardCounts, listInbox, listKnowledgeDrafts } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { documents } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { readAutopilot } from "@/lib/autopilot";
import { getWorkspaceAccess } from "@/lib/context";
import { excerpt } from "@/lib/format";
import { listMychefKeys } from "@/data/mychef-store";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "cn";

export const metadata = { title: "Dashboard" };
export const instant = false;

export default async function DashboardPage({
  params,
}: PageProps<"/[workspace]/dashboard">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const neon = usesMychefInbox();
  const counts = neon ? await dashboardCounts() : await localCounts(access.ctx.orgId);
  const recent = neon ? await listInbox("pending_review", 1) : null;
  const drafts = neon ? await listKnowledgeDrafts() : [];
  const keys = neon ? await listMychefKeys() : [];
  const autopilot = neon ? await readAutopilot() : { enabled: false };
  const activeKeys = keys.filter((row) => row.enabled).length;
  const groups = drafts.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.group] = (acc[doc.group] ?? 0) + 1;
    return acc;
  }, {});
  const slug = access.ctx.orgSlug;

  const nextSteps = [
    {
      title: "Review the inbox",
      body: `${counts.needsReply} conversation${counts.needsReply === 1 ? "" : "s"} waiting for a human decision.`,
      href: `/${slug}/inbox`,
      cta: "Open inbox",
    },
    {
      title: "Check knowledge",
      body: `${counts.knowledge} curated positions and playbooks. Edits stay as drafts until you publish.`,
      href: `/${slug}/knowledge`,
      cta: "Open knowledge",
    },
    {
      title: "Add provider keys",
      body:
        activeKeys > 0
          ? `${activeKeys} active key${activeKeys === 1 ? "" : "s"} stored. Start with Vercel AI Gateway or DeepSeek.`
          : "No keys yet. Paste Vercel AI Gateway or DeepSeek first. Keys stay encrypted on the server.",
      href: `/${slug}/settings/keys`,
      cta: "Open keys",
    },
  ];

  const cards = [
    { label: "Waiting for review", value: counts.needsReply, href: `/${slug}/inbox` },
    {
      label: "Recorded decisions",
      value: counts.decisions,
      href: `/${slug}/inbox?status=reviewed`,
    },
    { label: "Knowledge", value: counts.knowledge, href: `/${slug}/knowledge` },
    { label: "Contacts", value: counts.contacts, href: `/${slug}/inbox` },
    { label: "Messages", value: counts.messages, href: `/${slug}/inbox` },
    { label: "Candidate rules", value: counts.candidates, href: `/${slug}/candidates` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">
          Welcome{access.ctx.name ? `, ${access.ctx.name}` : ""}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          You are in {access.ctx.orgName}. Pick a next step below. Nothing sends itself from this
          console.
        </p>
      </div>
      <Alert>
        <AlertTitle>
          {autopilot.enabled ? "Sending is not connected." : "Automatic sending is not on"}
        </AlertTitle>
        <AlertDescription>
          {autopilot.enabled
            ? "Auto-pilot may mark a high-confidence draft as a candidate. It still does not deliver the reply."
            : "Every draft stays pending until someone reviews it. Change that later under Auto-pilot."}
        </AlertDescription>
      </Alert>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Start here</h3>
        <ul className="grid gap-3 md:grid-cols-3">
          {nextSteps.map((step) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardHeader className="gap-3">
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription className="leading-6">{step.body}</CardDescription>
                  <Link
                    href={step.href}
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-fit")}
                  >
                    {step.cta}
                  </Link>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>
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
                href={`/${slug}/knowledge?group=${group}`}
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
                <Link href={`/${slug}/inbox/${row.id}`} className="text-sm">
                  <span className="font-medium">{row.name ?? "Contact"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {excerpt(row.inbound ?? "No inbound text", 90)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
