/**
 * Approve or revoke console operators.
 * Passwords stored as scrypt hashes only. Owner bali@mychef.id cannot be revoked here.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import {
  approveOperatorAction,
  revokeOperatorAction,
} from "@/app/[workspace]/settings/access/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usesMychefInbox } from "@/db/mode";
import { getWorkspaceAccess } from "@/lib/context";
import { listOperators } from "@/lib/operators";
import { canManageKeys } from "@/lib/workspace-access";

export const metadata = { title: "Access" };
export const instant = false;

export default async function AccessPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/access">) {
  const { workspace } = await params;
  const query = await searchParams;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const manage = canManageKeys(access.ctx.role);
  const neon = usesMychefInbox();
  const operators = neon ? await listOperators() : [];
  const error = typeof query.error === "string" ? query.error : "";
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Access</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Approve who can sign in to this console. Passwords are hashed with scrypt and
          never shown again. The approved owner is bali@mychef.id.
        </p>
      </div>
      {!neon ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Operators live on myCHEF</EmptyTitle>
            <EmptyDescription>
              Point DATABASE_URL at mychef_runtime to manage approved emails here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {saved ? (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>Operator list updated. Nothing was sent.</AlertDescription>
            </Alert>
          ) : null}
          <ul className="flex flex-col gap-3">
            {operators.map((op) => (
              <li
                key={op.id}
                className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{op.name}</p>
                  <p className="text-sm text-muted-foreground">{op.email}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{op.role}</Badge>
                    <Badge variant={op.approved && op.enabled ? "secondary" : "outline"}>
                      {op.approved && op.enabled ? "Approved" : "Revoked"}
                    </Badge>
                  </div>
                </div>
                {manage && op.email !== "bali@mychef.id" ? (
                  <form
                    action={(op.approved && op.enabled
                      ? revokeOperatorAction
                      : approveOperatorAction
                    ).bind(null, access.ctx.orgSlug)}
                  >
                    <input type="hidden" name="email" value={op.email} />
                    <Button type="submit" variant="outline" size="sm">
                      {op.approved && op.enabled ? "Revoke" : "Approve"}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {manage ? (
            <form
              action={approveOperatorAction.bind(null, access.ctx.orgSlug)}
              className="flex flex-col gap-4 rounded-xl border p-4"
            >
              <h3 className="text-sm font-medium">Approve an operator</h3>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" name="email" type="email" required autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" required autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Temporary password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <Select name="role" defaultValue="reviewer">
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-fit">
                Save operator
              </Button>
            </form>
          ) : (
            <Alert>
              <AlertTitle>Read only</AlertTitle>
              <AlertDescription>Only an owner or admin can approve operators.</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
