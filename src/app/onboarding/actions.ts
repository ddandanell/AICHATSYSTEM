"use server";

import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { appDb } from "@/db/client";
import { memberships, organizations } from "@/db/schema";
import { slugify } from "@/lib/format";

export type ActionState = { error?: string } | null;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function userId() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function createWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = await userId();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  if (name.length < 2) return { error: "Name the workspace." };
  if (!SLUG.test(slug)) {
    return { error: "Use a short slug: lowercase letters, numbers, and hyphens." };
  }
  const taken = await appDb
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (taken[0]) return { error: "That slug is already taken." };

  const inserted = await appDb
    .insert(organizations)
    .values({ name, slug })
    .returning({ id: organizations.id });
  await appDb.insert(memberships).values({
    orgId: inserted[0].id,
    userId: id,
    role: "owner",
  });
  redirect(`/${slug}/inbox`);
}

export async function joinWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = await userId();
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (!SLUG.test(slug)) return { error: "Enter the workspace slug." };
  const orgRows = await appDb
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  const org = orgRows[0];
  if (!org) return { error: "No workspace uses that slug." };
  const existing = await appDb
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, id)))
    .limit(1);
  if (!existing[0]) {
    await appDb.insert(memberships).values({
      orgId: org.id,
      userId: id,
      role: "viewer",
    });
  }
  redirect(`/${slug}/inbox`);
}
