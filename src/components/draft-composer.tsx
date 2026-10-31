"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { DraftActionState } from "@/app/[workspace]/inbox/actions";

export function DraftComposer({
  action,
}: {
  action: (prev: DraftActionState, formData: FormData) => Promise<DraftActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Draft from a pasted message</h3>
        <p className="text-sm text-muted-foreground">
          One inbound note. The server drafts a reply for this workspace and leaves it pending. Nothing is sent.
        </p>
      </div>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not draft</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inbound">Client message</FieldLabel>
          <Textarea
            id="inbound"
            name="inbound"
            required
            rows={5}
            maxLength={4000}
            placeholder="Paste the message the client sent."
          />
          <FieldDescription>
            If this workspace has no provider key, the draft quotes the closest position and says it was not produced by a provider.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Draft reply
      </Button>
    </form>
  );
}
