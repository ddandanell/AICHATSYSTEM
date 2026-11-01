/**
 * Workspace chrome for the decision console.
 * Purpose: header + nav; inbox desk goes full-bleed via WorkspaceMain.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 */
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { ConsoleNav } from "@/components/console-nav";
import { WorkspaceMain } from "@/components/workspace-main";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceAccess } from "@/lib/context";
import { roleLabel } from "@/lib/format";
import { listMyWorkspaces } from "@/lib/workspace-access";

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/[workspace]">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status === "forbidden") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Not a member</CardTitle>
            <CardDescription>
              You are signed in, but this session is not a member of {access.orgName}.
              Their decisions stay closed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button render={<Link href="/" />}>Your workspaces</Button>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const ctx = access.ctx;
  const workspaces = await listMyWorkspaces(ctx.userId);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={`/${ctx.orgSlug}/inbox`} className="text-sm text-muted-foreground">
                Inbox mychef
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-medium">{ctx.orgName}</h1>
                <Badge variant="secondary">{roleLabel(ctx.role)}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden text-sm text-muted-foreground sm:block">
                {ctx.name ?? ctx.email}
              </p>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          {workspaces.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {workspaces.map((item) => (
                <Button
                  key={item.slug}
                  size="sm"
                  variant={item.slug === ctx.orgSlug ? "secondary" : "ghost"}
                  render={<Link href={`/${item.slug}/inbox`} />}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          ) : null}
          <ConsoleNav slug={ctx.orgSlug} />
        </div>
      </header>
      <WorkspaceMain>{children}</WorkspaceMain>
    </div>
  );
}
