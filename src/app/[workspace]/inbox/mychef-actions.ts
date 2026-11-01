"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  draftForConversation,
  proposeFromDecision,
  recordOutcome,
  reviewConversation,
} from "@/data/mychef-store";
import { getWorkspaceAccess } from "@/lib/context";
import { isLearnableReason } from "@/lib/learning-queue";
import {
  isHumanDecision,
  isReasonCode,
  OUTCOMES,
  type Outcome,
} from "@/lib/reason-codes";
import { canReview } from "@/lib/workspace-access";

export type ActionState = { error?: string; message?: string } | null;

export async function draftConversationAction(conversationId: string): Promise<void> {
  const access = await getWorkspaceAccess("mychef");
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  await draftForConversation(conversationId, access.ctx.email || access.ctx.userId);
  revalidatePath(`/mychef/inbox/${conversationId}`);
}

export async function reviewConversationAction(
  conversationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await getWorkspaceAccess("mychef");
  if (access.status !== "ok" || !canReview(access.ctx.role)) {
    return { error: "You cannot review this conversation." };
  }
  const humanDecision = String(formData.get("human_decision") ?? "");
  const reasonCode = String(formData.get("reason_code") ?? "");
  const rationale = String(formData.get("rationale") ?? "").trim();
  const whyNot = String(formData.get("why_not") ?? "").trim();
  const finalText = String(formData.get("final_text") ?? "");
  if (!isHumanDecision(humanDecision)) return { error: "Choose a decision." };
  if (!isReasonCode(reasonCode)) return { error: "Choose a reason code." };
  if (!rationale || !whyNot) {
    return { error: "Say why this reply, and why not the alternative." };
  }
  if (
    (humanDecision === "edited" || humanDecision === "rejected" || humanDecision === "escalated") &&
    !isLearnableReason(reasonCode)
  ) {
    return {
      error:
        "Edits and rejects need a learning reason (not Good as drafted) so the case can enter the Learning Queue.",
    };
  }
  const saved = await reviewConversation(conversationId, access.ctx.email || access.ctx.userId, {
    humanDecision,
    reasonCode,
    rationale,
    whyNot,
    finalText,
  });
  if (!saved.ok) return { error: saved.error };

  const actor = access.ctx.email || access.ctx.userId;
  const learnable =
    humanDecision === "edited" ||
    humanDecision === "rejected" ||
    humanDecision === "escalated";
  if (learnable && isLearnableReason(reasonCode)) {
    const proposed = await proposeFromDecision(saved.id, actor);
    revalidatePath("/mychef/candidates");
    revalidatePath(`/mychef/inbox/${saved.id}`);
    if (proposed.ok && proposed.queued && proposed.id && proposed.queueType) {
      redirect(
        `/mychef/candidates?from=inbox&highlight=${encodeURIComponent(proposed.id)}&type=${encodeURIComponent(proposed.queueType)}`,
      );
    }
  }

  redirect(`/mychef/inbox/${saved.id}`);
}

export async function outcomeAction(decisionId: string, formData: FormData): Promise<void> {
  const access = await getWorkspaceAccess("mychef");
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  const outcome = String(formData.get("outcome") ?? "");
  if (!OUTCOMES.includes(outcome as Outcome)) return;
  await recordOutcome(decisionId, access.ctx.email || access.ctx.userId, outcome as Outcome);
  revalidatePath(`/mychef/inbox/${decisionId}`);
}
