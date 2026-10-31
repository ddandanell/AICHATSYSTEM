import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { appDb } from "@/db/client";
import { memberships, users } from "@/db/schema";
import { getWorkspaceAccess } from "@/lib/context";
import { roleLabel } from "@/lib/format";

export const metadata = { title: "Team" };

export default async function TeamPage({
  params,
}: PageProps<"/[workspace]/team">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const rows = await appDb
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, access.ctx.orgId));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Team</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Membership is read from this workspace only. Invites and role changes
          are not in this slice.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name ?? "—"}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{roleLabel(row.role)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
