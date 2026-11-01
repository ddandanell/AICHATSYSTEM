/**
 * Internal myCHEF staff/admin sign-in.
 * Controlled operators only on Neon. Hashed passwords. No credentials on this page.
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

export const metadata = { title: "Admin login" };
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
        Check your email and password, or ask an owner to approve your access.
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
          myCHEF · Inbox mychef
        </p>
        <h1 className="max-w-lg font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          Internal admin login
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          Staff and administrators only. This is the myCHEF operations console — not a
          public product signup.
        </p>
      </section>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {neon
              ? "Approved myCHEF staff and admins only."
              : "Local Docker fallback for Harbor Kitchen demos."}
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
              Sign in
            </Button>
          </form>
          {!neon ? (
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
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
