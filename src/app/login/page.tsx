/**
 * Internal myCHEF staff/admin sign-in.
 * Controlled operators only on Neon. Hashed passwords. No credentials on this page.
 * Do not auto-send.
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

export const metadata = { title: "Admin login" };
export const instant = false;

async function BounceIfSignedIn() {
  await connection();
  const session = await auth();
  if (session?.user?.id) redirect("/");
  return null;
}

const SEEDED = [
  { email: "maya@harbor-kitchen.example", name: "Maya Chen", note: "myCHEF" },
  { email: "jonah@northline.example", name: "Jonah Hale", note: "No myCHEF membership" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const mychef = usesMychefInbox();
  const failed = query.error === "1";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 md:flex-row md:items-center md:px-6 md:py-16">
      <Suspense fallback={null}>
        <BounceIfSignedIn />
      </Suspense>
      <section className="flex flex-1 flex-col gap-5">
        <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
          myCHEF · Inbox mychef
        </p>
        <h1 className="max-w-lg text-4xl leading-tight tracking-tight md:text-5xl">
          Internal admin login
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground">
          Staff and administrators only. This is the myCHEF operations console — not a
          public product signup.
        </p>
      </section>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {mychef
              ? "Approved myCHEF staff and admins only."
              : "Local Docker fallback for Harbor Kitchen demos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {failed ? (
            <Alert variant="destructive">
              <AlertTitle>Could not sign in</AlertTitle>
              <AlertDescription>
                Check your email and password, or ask an owner to approve your access.
              </AlertDescription>
            </Alert>
          ) : null}
          <form action={loginAction} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="username" />
              </Field>
              {mychef ? (
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
                  <Input id="name" name="name" autoComplete="name" placeholder="Only used for a new account" />
                </Field>
              )}
            </FieldGroup>
            <Button type="submit" size="lg">
              Sign in
            </Button>
          </form>
          {mychef ? null : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Seeded local sessions</p>
              {SEEDED.map((person) => (
                <form key={person.email} action={loginAction}>
                  <input type="hidden" name="email" value={person.email} />
                  <input type="hidden" name="name" value={person.name} />
                  <Button type="submit" variant="outline" className="w-full justify-between">
                    <span>{person.name}</span>
                    <span className="text-muted-foreground">{person.note}</span>
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
