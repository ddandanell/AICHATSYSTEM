"use client";
/**
 * Keys UI for /settings/keys. Never renders the full secret. Do not auto-send.
 */

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatWhen, formatWhenKl } from "@/lib/format";
import {
  PRIMARY_PROVIDERS,
  PROVIDER_LABELS,
  PROVIDERS,
  providerHost,
  type Provider,
} from "@/lib/providers";
import type { ActionState } from "@/app/[workspace]/settings/keys/actions";

type KeyRow = {
  id: string;
  provider: Provider;
  keyHint: string | null;
  baseUrl: string | null;
  isActive: boolean;
  createdAt: string;
  rotatedAt: string | null;
  verifiedAt: string | null;
  lastError: string | null;
};

function Result({ state }: { state: ActionState }) {
  if (!state?.error && !state?.message) return null;
  return (
    <Alert variant={state.error ? "destructive" : "default"}>
      <AlertTitle>{state.error ? "Key action failed" : "Key action"}</AlertTitle>
      <AlertDescription>{state.error ?? state.message}</AlertDescription>
    </Alert>
  );
}

function PendingButton({
  pending,
  label,
  variant = "default",
}: {
  pending: boolean;
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {label}
    </Button>
  );
}

export function KeyManager({
  rows,
  canManage,
  saveAction,
  rotateAction,
  revokeAction,
  testAction,
}: {
  rows: KeyRow[];
  canManage: boolean;
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  rotateAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  revokeAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  testAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [saveState, saveForm, savePending] = useActionState(saveAction, null);
  const [testState, testForm, testPending] = useActionState(testAction, null);

  const stored = new Map(rows.map((row) => [row.provider, row]));

  return (
    <div className="flex flex-col gap-6">
      <Result state={saveState} />
      <Result state={testState} />
      <div className="grid gap-4 lg:grid-cols-2">
        {PRIMARY_PROVIDERS.map((provider) => (
          <PrimaryKeyCard
            key={provider}
            provider={provider}
            row={stored.get(provider) ?? null}
            canManage={canManage}
            saveAction={saveAction}
            testAction={testAction}
            revokeAction={revokeAction}
          />
        ))}
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No keys stored</CardTitle>
            <CardDescription>
              Add a provider key or run a test. A test with nothing stored
              returns a no-key result and does not invent a completion.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Hint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Rotated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{PROVIDER_LABELS[row.provider]}</TableCell>
                <TableCell>{row.keyHint ? `•••• ${row.keyHint}` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? "secondary" : "outline"}>
                    {row.isActive ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell>{formatWhen(row.createdAt)}</TableCell>
                <TableCell>{formatWhen(row.rotatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add another provider</CardTitle>
              <CardDescription>
                OpenAI, Anthropic, Google, Azure, and Bedrock sit behind Vercel
                AI Gateway and DeepSeek. The full key is encrypted and never
                shown again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveForm} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="add-provider">Provider</FieldLabel>
                    <Select name="provider" defaultValue="vercel_gateway">
                      <SelectTrigger id="add-provider" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PROVIDERS.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {PROVIDER_LABELS[provider]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-base-url">Base URL</FieldLabel>
                    <Input
                      id="add-base-url"
                      name="base_url"
                      placeholder="https://ai-gateway.vercel.sh/v1"
                      autoComplete="off"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-secret">Key</FieldLabel>
                    <Input
                      id="add-secret"
                      name="secret"
                      type="password"
                      autoComplete="off"
                      required
                    />
                  </Field>
                </FieldGroup>
                <PendingButton pending={savePending} label="Save key" />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Test a provider</CardTitle>
              <CardDescription>
                One server-side call. The browser never sees the key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={testForm} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="test-provider">Provider</FieldLabel>
                  <Select name="provider" defaultValue="vercel_gateway">
                    <SelectTrigger id="test-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {PROVIDER_LABELS[provider]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <PendingButton pending={testPending} label="Test connection" variant="outline" />
              </form>
            </CardContent>
          </Card>
          {rows.map((row) => (
            <KeyRowActions
              key={row.id}
              row={row}
              rotateAction={rotateAction}
              revokeAction={revokeAction}
            />
          ))}
        </div>
      ) : (
        <Alert>
          <AlertTitle>Read only</AlertTitle>
          <AlertDescription>
            Only an owner or admin can add, rotate, revoke, or test keys.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function PrimaryKeyCard({
  provider,
  row,
  canManage,
  saveAction,
  testAction,
  revokeAction,
}: {
  provider: Provider;
  row: KeyRow | null;
  canManage: boolean;
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  testAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  revokeAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [saveState, saveForm, savePending] = useActionState(saveAction, null);
  const [testState, testForm, testPending] = useActionState(testAction, null);
  const [revokeState, revokeForm, revokePending] = useActionState(revokeAction, null);
  const host = row?.baseUrl || providerHost(provider);
  const status = !row ? "Not stored" : row.isActive ? "Active" : "Revoked";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{PROVIDER_LABELS[provider]}</CardTitle>
        <CardDescription>
          {provider === "vercel_gateway"
            ? "Paste a Vercel AI Gateway key. Leave the base URL empty to use the default host."
            : "Paste a DeepSeek key. Requests go to the DeepSeek host below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={row?.isActive ? "secondary" : "outline"}>{status}</Badge>
          <span className="text-sm text-muted-foreground">
            {row?.keyHint ? `Hint •••• ${row.keyHint}` : "No hint yet"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{host}</p>
        <p className="text-sm text-muted-foreground">
          Last check {row?.verifiedAt ? formatWhenKl(row.verifiedAt) : "not run"}
        </p>
        {row?.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>Last check failed</AlertTitle>
            <AlertDescription>{row.lastError}</AlertDescription>
          </Alert>
        ) : null}
        <Result state={saveState} />
        <Result state={testState} />
        <Result state={revokeState} />
        {canManage ? (
          <>
            <form action={saveForm} className="flex flex-col gap-4">
              <input type="hidden" name="provider" value={provider} />
              <FieldGroup>
                {provider === "vercel_gateway" ? (
                  <Field>
                    <FieldLabel htmlFor={`${provider}-base`}>Base URL</FieldLabel>
                    <Input
                      id={`${provider}-base`}
                      name="base_url"
                      defaultValue={row?.baseUrl ?? ""}
                      placeholder="https://ai-gateway.vercel.sh/v1"
                      autoComplete="off"
                    />
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor={`${provider}-secret`}>
                    {row?.isActive ? "Replacement key" : "Key"}
                  </FieldLabel>
                  <Input
                    id={`${provider}-secret`}
                    name="secret"
                    type="password"
                    autoComplete="off"
                    required
                  />
                </Field>
              </FieldGroup>
              <PendingButton pending={savePending} label={row?.isActive ? "Replace key" : "Save key"} />
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={testForm}>
                <input type="hidden" name="provider" value={provider} />
                <PendingButton pending={testPending} label="Test connection" variant="outline" />
              </form>
              {row ? (
                <form action={revokeForm}>
                  <input type="hidden" name="provider" value={provider} />
                  <PendingButton pending={revokePending} label="Revoke" variant="destructive" />
                </form>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KeyRowActions({
  row,
  rotateAction,
  revokeAction,
}: {
  row: KeyRow;
  rotateAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  revokeAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [rotateState, rotateForm, rotatePending] = useActionState(rotateAction, null);
  const [revokeState, revokeForm, revokePending] = useActionState(revokeAction, null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{PROVIDER_LABELS[row.provider]}</CardTitle>
        <CardDescription>
          {row.isActive ? `Active hint •••• ${row.keyHint ?? ""}` : "Revoked"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Result state={rotateState} />
        <Result state={revokeState} />
        <form action={rotateForm} className="flex flex-col gap-3">
          <input type="hidden" name="provider" value={row.provider} />
          <Field>
            <FieldLabel htmlFor={`rotate-${row.id}`}>Replacement key</FieldLabel>
            <Input
              id={`rotate-${row.id}`}
              name="secret"
              type="password"
              autoComplete="off"
              required
            />
          </Field>
          <PendingButton pending={rotatePending} label="Rotate" />
        </form>
        <form action={revokeForm}>
          <input type="hidden" name="provider" value={row.provider} />
          <PendingButton pending={revokePending} label="Revoke" variant="destructive" />
        </form>
      </CardContent>
    </Card>
  );
}
