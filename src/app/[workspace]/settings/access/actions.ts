"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveOperator, type OperatorRole } from "@/lib/operators";
import { getWorkspaceAccess } from "@/lib/context";
import { canManageKeys } from "@/lib/workspace-access";

function roleOf(value: string): OperatorRole {
  if (value === "owner" || value === "admin" || value === "reviewer") return value;
  return "reviewer";
}

export async function saveOperatorAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canManageKeys(access.ctx.role)) {
    redirect(`/${slug}/settings/access?error=You+cannot+change+access.`);
  }
  const saved = await saveOperator({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: roleOf(String(formData.get("role") ?? "reviewer")),
    approved: formData.get("approved") === "on",
  });
  revalidatePath(`/${slug}/settings/access`);
  if (!saved.ok) {
    redirect(`/${slug}/settings/access?error=${encodeURIComponent(saved.error)}`);
  }
  redirect(`/${slug}/settings/access?saved=1`);
}
