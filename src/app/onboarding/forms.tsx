"use client";
/**
 * Local onboarding forms. Do not auto-send.
 */

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { ActionState } from "@/app/onboarding/actions";

export function WorkspaceForms({
  createAction,
  joinAction,
}: {
  createAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  joinAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [createState, createForm, createPending] = useActionState(createAction, null);
  const [joinState, joinForm, joinPending] = useActionState(joinAction, null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create</CardTitle>
          <CardDescription>You become the owner.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createForm} className="flex flex-col gap-4">
            {createState?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{createState.error}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" required placeholder="Harbor Kitchen" />
              </Field>
              <Field>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input id="slug" name="slug" placeholder="harbor-kitchen" />
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={createPending}>
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Join</CardTitle>
          <CardDescription>
            Local fallback only. Joining adds you as a viewer. There is no invite token yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={joinForm} className="flex flex-col gap-4">
            {joinState?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{joinState.error}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="join-slug">Slug</FieldLabel>
              <Input id="join-slug" name="slug" required placeholder="northline" />
            </Field>
            <Button type="submit" variant="outline" disabled={joinPending}>
              Join as viewer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
