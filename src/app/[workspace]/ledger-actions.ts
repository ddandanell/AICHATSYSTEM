"use server";

import { revalidatePath } from "next/cache";
import { runMychefEvals, runMychefLearning, setMychefRuleStatus } from "@/data/mychef-store";
import { getWorkspaceAccess } from "@/lib/context";
import { runWorkspaceEvals } from "@/lib/eval-runner";
import { runLearningLoop, setRuleStatus } from "@/lib/learning-loop";
import { usesMychefInbox } from "@/db/mode";
import { canReview } from "@/lib/workspace-access";

export async function learnAction(slug: string) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  if (usesMychefInbox()) {
    await runMychefLearning(access.ctx.email || access.ctx.userId);
  } else {
    await runLearningLoop(access.ctx.orgId, access.ctx.userId);
  }
  revalidatePath(`/${slug}/candidates`);
}

export async function ruleStatusAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return;
  if (usesMychefInbox()) {
    if (status !== "approved" && status !== "retired") return;
    await setMychefRuleStatus(id, status, access.ctx.email || access.ctx.userId);
  } else if (status === "active" || status === "deprecated") {
    await setRuleStatus(access.ctx.orgId, id, status);
  }
  revalidatePath(`/${slug}/candidates`);
}

export async function evalAction(slug: string) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  if (usesMychefInbox()) {
    await runMychefEvals(access.ctx.email || access.ctx.userId);
  } else {
    await runWorkspaceEvals(access.ctx.orgId);
  }
  revalidatePath(`/${slug}/evals`);
}
