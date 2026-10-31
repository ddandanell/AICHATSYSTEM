"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  draftForConversation,
  recordOutcome,
  reviewConversation,
} from "@/data/mychef-store";
import { getWorkspaceAccess } from "@/lib/context";
import { isHumanDecision, isReasonCode, OUTCOMES, type Outcome } from "@/lib/reason-codes";
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
  if (!rationale || !whyNot) return { error: "Say why this reply, and why not the alternative." };
  const saved = await reviewConversation(conversationId, access.ctx.email || access.ctx.userId, {
    humanDecision,
    reasonCode,
    rationale,
    whyNot,
    finalText,
  });
  if (!saved.ok) return { error: saved.error };
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
