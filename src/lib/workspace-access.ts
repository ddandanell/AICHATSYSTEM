import { and, eq, sql } from "drizzle-orm";
import { appDb } from "@/db/client";
import { usesMychefInbox } from "@/db/mode";
import { memberships, organizations, users } from "@/db/schema";

export type Role = "owner" | "admin" | "reviewer" | "viewer";

export type WorkspaceContext = {
  userId: string;
  orgId: string;
  role: Role;
  orgSlug: string;
  orgName: string;
  email: string;
  name: string | null;
};

export type WorkspaceAccess =
  | { status: "ok"; ctx: WorkspaceContext }
  | { status: "unknown" }
  | { status: "forbidden"; orgName: string; orgSlug: string };

const ROLES = new Set<Role>(["owner", "admin", "reviewer", "viewer"]);

function asRole(value: string): Role {
  if (ROLES.has(value as Role)) return value as Role;
  throw new Error(`unexpected role ${value}`);
}

export async function findOrCreateUser(email: string, name: string | null) {
  const normalized = email.trim().toLowerCase();
  const existing = await appDb
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await appDb
    .insert(users)
    .values({ email: normalized, name })
    .returning();
  return inserted[0];
}

export async function authorizeWorkspace(
  userId: string,
  slug: string,
  profile?: { email?: string | null; name?: string | null },
): Promise<WorkspaceAccess> {
  if (usesMychefInbox()) {
    if (slug !== "mychef") return { status: "unknown" };
    return {
      status: "ok",
      ctx: {
        userId,
        orgId: "mychef",
        role: "owner",
        orgSlug: "mychef",
        orgName: "myCHEF",
        email: profile?.email ?? "",
        name: profile?.name ?? null,
      },
    };
  }
  const orgRows = await appDb
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  const org = orgRows[0];
  if (!org) return { status: "unknown" };

  const memberRows = await appDb
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId)))
    .limit(1);
  const member = memberRows[0];
  if (!member) {
    return { status: "forbidden", orgName: org.name, orgSlug: org.slug };
  }

  const userRows = await appDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];

  return {
    status: "ok",
    ctx: {
      userId,
      orgId: org.id,
      role: asRole(member.role),
      orgSlug: org.slug,
      orgName: org.name,
      email: user?.email ?? "",
      name: user?.name ?? null,
    },
  };
}

export async function listMyWorkspaces(userId: string) {
  if (usesMychefInbox()) {
    return [{ slug: "mychef", name: "myCHEF", role: "owner" }];
  }
  const rows = await appDb
    .select({
      slug: organizations.slug,
      name: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.name);
  return rows;
}

export function canReview(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "reviewer";
}

export function canManageKeys(role: Role): boolean {
  return role === "owner" || role === "admin";
}
