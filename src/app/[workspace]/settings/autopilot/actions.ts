"use server";
/**
 * Saves the autopilot switch. Row id autopilot. Do not auto-send.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveAutopilot } from "@/lib/autopilot";
import { getWorkspaceAccess } from "@/lib/context";
import { canManageKeys } from "@/lib/workspace-access";

export async function saveAutopilotAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canManageKeys(access.ctx.role)) {
    redirect(`/${slug}/settings/autopilot?error=You+cannot+change+auto-pilot.`);
  }
  const raw = Number(formData.get("threshold"));
  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    redirect(`/${slug}/settings/autopilot?error=Use+a+threshold+from+0+to+1.`);
  }
  const enabled = formData.get("enabled") === "on";
  await saveAutopilot({ enabled, confidenceThreshold: raw });
  revalidatePath(`/${slug}/settings/autopilot`);
  revalidatePath(`/${slug}`, "layout");
  redirect(`/${slug}/settings/autopilot?saved=1`);
}
