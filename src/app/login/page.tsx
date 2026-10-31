/**
 * Welcome sign-in for Inbox mychef.
 * Controlled operators only on Neon. Hashed passwords. No auto-send.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { loginAction } from "@/app/login/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usesMychefInbox } from "@/db/mode";
import { ensureBootstrapOperator } from "@/lib/operators";

export const metadata = { title: "Welcome" };
export const instant = false;

async function BounceIfSignedIn() {
  await connection();
  if (usesMychefInbox()) {
    await ensureBootstrapOperator();
  }
  const session = await auth();
  if (session?.user?.id) redirect("/");
  return null;
}

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (query.error !== "credentials") return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not sign in</AlertTitle>
      <AlertDescription>
        Use an approved email and password. Ask an owner on Access if you need an account.
      </AlertDescription>
    </Alert>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const neon = usesMychefInbox();

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 md:flex-row md:items-center md:gap-14 md:px-6 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,oklch(0.94_0.03_85),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.93_0.02_200),transparent_50%)]"
      />
      <Suspense fallback={null}>
        <BounceIfSignedIn />
      </Suspense>
      <section className="flex flex-1 flex-col gap-5">
        <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
          myCHEF Inbox
        </p>
        <h1 className="max-w-lg font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          Welcome back to the decision ledger
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          This console reads guest messages, drafts a reply for you to review, and
          records why you accepted or changed it. It does not send anything on its own.
        </p>
        <ol className="max-w-md list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Sign in with your approved email and password.</li>
          <li>Open the dashboard for what needs a reply.</li>
          <li>Review Inbox, update Knowledge, or paste provider Keys.</li>
        </ol>
      </section>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {neon
              ? "Only approved operators can open myCHEF. Passwords stay hashed on the server."
              : "Local Docker fallback. Email creates or finds your account; no password is stored here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>
          <form action={loginAction} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder={neon ? "you@mychef.id" : "you@example.com"}
                />
              </Field>
              {neon ? (
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Only used for a new account"
                  />
                </Field>
              )}
            </FieldGroup>
            <Button type="submit" size="lg">
              {neon ? "Enter the ledger" : "Continue"}
            </Button>
          </form>
          {neon ? (
            <Alert>
              <AlertTitle>Automatic sending is not on</AlertTitle>
              <AlertDescription>
                After you sign in you land on the dashboard. Approve operators under
                Settings → Access. Provider keys stay encrypted on the server.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Seeded local sessions</p>
              <form action={loginAction}>
                <input type="hidden" name="email" value="maya@harbor-kitchen.example" />
                <input type="hidden" name="name" value="Maya Chen" />
                <Button type="submit" variant="outline" className="w-full justify-between">
                  <span>Maya Chen</span>
                  <span className="text-muted-foreground">Harbor Kitchen</span>
                </Button>
              </form>
              <form action={loginAction}>
                <input type="hidden" name="email" value="jonah@northline.example" />
                <input type="hidden" name="name" value="Jonah Hale" />
                <Button type="submit" variant="outline" className="w-full justify-between">
                  <span>Jonah Hale</span>
                  <span className="text-muted-foreground">Northline</span>
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
