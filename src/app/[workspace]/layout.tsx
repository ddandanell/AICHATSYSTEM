import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { ConsoleNav } from "@/components/console-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usesMychefInbox } from "@/db/mode";
import { readAutopilot } from "@/lib/autopilot";
import { getWorkspaceAccess } from "@/lib/context";
import { roleLabel } from "@/lib/format";
import { listMyWorkspaces } from "@/lib/workspace-access";

export const instant = false;

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
            <CardTitle>Not approved for this workspace</CardTitle>
            <CardDescription>
              You are signed in, but this email is not an approved operator for {access.orgName}.
              Ask an owner under Access, or sign out.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button render={<Link href="/" />}>Home</Button>
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
  const autopilot = usesMychefInbox()
    ? await readAutopilot()
    : { enabled: false, confidenceThreshold: 0.8 };

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={`/${ctx.orgSlug}/dashboard`} className="text-sm text-muted-foreground">
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
                  render={<Link href={`/${item.slug}/dashboard`} />}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          ) : null}
          <ConsoleNav slug={ctx.orgSlug} />
          <p className="text-sm text-muted-foreground">
            {autopilot.enabled
              ? "Sending is not connected."
              : "Automatic sending is not on. A review stays in the ledger and does not message the client."}
          </p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-6">
        {children}
      </div>
    </div>
  );
}
