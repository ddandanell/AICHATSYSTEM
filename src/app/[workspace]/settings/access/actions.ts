/**
 * Operator approve/revoke actions. Hashed passwords only; no secrets in logs.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/context";
import {
  setOperatorApproved,
  upsertOperator,
  type OperatorRole,
} from "@/lib/operators";
import { canManageKeys } from "@/lib/workspace-access";

function roleOf(value: FormDataEntryValue | null): OperatorRole {
  const raw = String(value ?? "");
  if (raw === "owner" || raw === "admin" || raw === "reviewer" || raw === "viewer") {
    return raw;
  }
  return "reviewer";
}

export async function approveOperatorAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canManageKeys(access.ctx.role)) {
    redirect(`/${slug}/settings/access?error=You+cannot+change+access.`);
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!password) {
    const toggled = await setOperatorApproved(email, true);
    if (!toggled.ok) redirect(`/${slug}/settings/access?error=${encodeURIComponent(toggled.error)}`);
  } else {
    const saved = await upsertOperator({
      email,
      name: String(formData.get("name") ?? ""),
      password,
      role: roleOf(formData.get("role")),
      approved: true,
    });
    if (!saved.ok) redirect(`/${slug}/settings/access?error=${encodeURIComponent(saved.error)}`);
  }
  revalidatePath(`/${slug}/settings/access`);
  redirect(`/${slug}/settings/access?saved=1`);
}

export async function revokeOperatorAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canManageKeys(access.ctx.role)) {
    redirect(`/${slug}/settings/access?error=You+cannot+change+access.`);
  }
  const email = String(formData.get("email") ?? "");
  const revoked = await setOperatorApproved(email, false);
  if (!revoked.ok) redirect(`/${slug}/settings/access?error=${encodeURIComponent(revoked.error)}`);
  revalidatePath(`/${slug}/settings/access`);
  redirect(`/${slug}/settings/access?saved=1`);
}
