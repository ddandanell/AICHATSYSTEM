"use server";

import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/context";
import { getDecision, saveReview } from "@/lib/decisions";
import { listKnowledge } from "@/lib/knowledge";
import { isHumanDecision, isReasonCode } from "@/lib/reason-codes";
import { canReview } from "@/lib/workspace-access";
import type { SourceMark } from "@/db/schema";

export type ActionState = { error?: string } | null;

export async function reviewAction(
  slug: string,
  decisionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok") {
    return { error: "You cannot review drafts in this workspace." };
  }
  if (!canReview(access.ctx.role)) {
    return { error: "Your role can read drafts. A reviewer records the decision." };
  }

  const humanDecision = String(formData.get("human_decision") ?? "");
  const reasonCode = String(formData.get("reason_code") ?? "");
  const rationale = String(formData.get("rationale") ?? "").trim();
  const whyNot = String(formData.get("why_not") ?? "").trim();
  const finalText = String(formData.get("final_text") ?? "");

  if (!isHumanDecision(humanDecision)) {
    return { error: "Choose accepted, edited, rejected, or escalated." };
  }
  if (!isReasonCode(reasonCode)) return { error: "Choose a reason code." };
  if (!rationale) return { error: "Say why this reply." };
  if (!whyNot) return { error: "Say why not the alternative." };

  const decision = await getDecision(access.ctx.orgId, decisionId);
  if (!decision) return { error: "That draft is not in this workspace." };

  const catalog = new Set(listKnowledge().map((doc) => doc.id));
  const cited = (decision.sourceRefs ?? []).map((ref) => ref.id);
  const irrelevant = new Set(
    formData
      .getAll("irrelevant")
      .map(String)
      .filter((id) => cited.includes(id)),
  );
  const sourceMarks: SourceMark[] = cited.map((id) => ({
    id,
    mark: irrelevant.has(id) ? "irrelevant" : "cited",
  }));
  for (const id of formData.getAll("missing").map(String)) {
    if (catalog.has(id) && !cited.includes(id)) {
      sourceMarks.push({ id, mark: "missing" });
    }
  }

  const saved = await saveReview(access.ctx.orgId, access.ctx.userId, decisionId, {
    humanDecision,
    reasonCode,
    rationale,
    whyNot,
    finalText,
    sourceMarks,
  });
  if (!saved.ok) return { error: saved.error };
  redirect(`/${slug}/inbox/${decisionId}`);
}
