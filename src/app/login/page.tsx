/**
 * Welcome sign-in. Operator password on Neon, email fallback on local Docker. Do not auto-send.
 */
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth, clerkConfigured } from "@/auth";
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
      <section className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Inbox mychef</p>
        <h1 className="max-w-md text-4xl font-medium tracking-tight">
          Welcome. The drafts are waiting for you.
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          myCHEF reads a guest message, proposes a reply, and stops. You approve it or say why it should change. Nothing is sent from this screen.
        </p>
        <ol className="flex max-w-md flex-col gap-2 text-sm text-muted-foreground">
          <li>1. Sign in with your approved email.</li>
          <li>2. Open a conversation in the inbox.</li>
          <li>3. Approve the draft, or edit it and say why.</li>
        </ol>
      </section>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {mychef
              ? "Only an approved operator can open the ledger."
              : "Local fallback for the seeded workspaces."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {failed ? (
            <Alert variant="destructive">
              <AlertTitle>Could not sign in</AlertTitle>
              <AlertDescription>
                That email is not approved, or the password does not match.
              </AlertDescription>
            </Alert>
          ) : null}
          {clerkConfigured ? (
            <Alert>
              <AlertTitle>Clerk keys are set</AlertTitle>
              <AlertDescription>
                This console still signs in with the operator password stored on the server.
              </AlertDescription>
            </Alert>
          ) : null}
          <form action={loginAction} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
              {mychef ? (
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" autoComplete="name" placeholder="Only used for a new account" />
                </Field>
              )}
            </FieldGroup>
            <Button type="submit">{mychef ? "Open the inbox" : "Continue"}</Button>
          </form>
          {mychef ? null : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Seeded sessions</p>
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
