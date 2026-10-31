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

async function BounceIfSignedIn() {
  await connection();
  const session = await auth();
  if (session?.user?.id) redirect("/");
  return null;
}

const SEEDED = [
  {
    email: "maya@harbor-kitchen.example",
    name: "Maya Chen",
    note: "myCHEF",
  },
  {
    email: "jonah@northline.example",
    name: "Jonah Hale",
    note: "No myCHEF membership",
  },
];

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 md:flex-row md:items-center md:px-6 md:py-16">
      <Suspense fallback={null}>
        <BounceIfSignedIn />
      </Suspense>
      <section className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">Inbox mychef</p>
        <h1 className="max-w-md text-4xl font-medium tracking-tight">
          The draft is a proposal. The ledger is the record.
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Review a reply, mark why it was right or wrong, and keep each
          workspace’s provider keys on the server. Nothing sends itself.
        </p>
      </section>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Local fallback. Email only — passwords stay with Clerk, and no
            password is stored here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {clerkConfigured ? (
            <Alert>
              <AlertTitle>Clerk keys are set</AlertTitle>
              <AlertDescription>
                This slice still signs in with Auth.js. Unset the Clerk keys
                to use the local fallback, or wire Clerk before relying on it.
              </AlertDescription>
            </Alert>
          ) : null}
          <form action={loginAction} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" placeholder="Only used for a new account" />
              </Field>
            </FieldGroup>
            <Button type="submit">Continue</Button>
          </form>
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
        </CardContent>
      </Card>
    </main>
  );
}
