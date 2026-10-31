"use server";
/**
 * Inbox review actions. Writes feedback and decision_records. Do not auto-send.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftForConversation, getConversation, reviewConversation } from "@/data/mychef-store";
import { setContactTags } from "@/data/inbox-board";
import { getWorkspaceAccess } from "@/lib/context";
import { isInboxTag, type InboxTag } from "@/lib/inbox-tags";
import { isReasonCode } from "@/lib/reason-codes";
import { canReview } from "@/lib/workspace-access";

export type ActionState = { error?: string } | null;

async function reviewer(slug: string) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) return null;
  return access.ctx;
}

export async function regenerateInboxAction(slug: string, formData: FormData) {
  const ctx = await reviewer(slug);
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (!id) return;
  await draftForConversation(id, ctx.email || ctx.userId, isInboxTag(tag) ? tag : null);
  revalidatePath(`/${slug}/inbox`);
  redirect(`/${slug}/inbox?id=${encodeURIComponent(id)}`);
}

export async function retagInboxAction(slug: string, formData: FormData) {
  const ctx = await reviewer(slug);
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  if (!id || !isInboxTag(tag)) return;
  const conversation = await getConversation(id);
  if (!conversation?.contact_id) return;
  await setContactTags(conversation.contact_id, [tag]);
  await draftForConversation(id, ctx.email || ctx.userId, tag);
  revalidatePath(`/${slug}/inbox`);
  redirect(`/${slug}/inbox?id=${encodeURIComponent(id)}&tagged=${tag}`);
}

export async function approveInboxAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await reviewer(slug);
  if (!ctx) return { error: "You cannot review this conversation." };
  const id = String(formData.get("id") ?? "");
  const original = String(formData.get("original") ?? "");
  const finalText = String(formData.get("final_text") ?? "");
  const changed = finalText.trim() !== original.trim();
  const mode = String(formData.get("mode") ?? "approve");
  const nextId = String(formData.get("next_id") ?? "");
  const tag = String(formData.get("tag") ?? "");
  const tags: InboxTag[] = isInboxTag(tag) ? [tag] : [];
  let humanDecision: "accepted" | "edited" | "escalated" = changed ? "edited" : "accepted";
  let reasonCode = String(formData.get("reason_code") ?? "");
  let rationale = String(formData.get("rationale") ?? "").trim();
  let whyNot = String(formData.get("why_not") ?? "").trim();
  if (mode === "escalate") {
    humanDecision = "escalated";
    reasonCode = "needs_human";
    rationale = rationale || "Escalated to a person.";
    whyNot = whyNot || "The draft should not go out as written.";
  } else if (!changed) {
    reasonCode = reasonCode || "good_as_drafted";
    rationale = rationale || "Accepted as drafted.";
    whyNot = whyNot || "No alternative was needed.";
  } else {
    if (!isReasonCode(reasonCode) || reasonCode === "good_as_drafted") {
      return { error: "Choose why you changed the draft." };
    }
    if (!rationale) return { error: "Say why this reply should be different." };
    whyNot = whyNot || "The original draft missed that.";
  }
  if (!isReasonCode(reasonCode)) return { error: "Choose a reason." };
  const saved = await reviewConversation(id, ctx.email || ctx.userId, {
    humanDecision,
    reasonCode,
    rationale,
    whyNot,
    finalText,
    remember: formData.get("remember") === "on",
    tags,
  });
  if (!saved.ok) return { error: saved.error };
  revalidatePath(`/${slug}/inbox`);
  revalidatePath(`/${slug}/candidates`);
  const next = nextId && nextId !== id ? `id=${encodeURIComponent(nextId)}&` : "";
  redirect(`/${slug}/inbox?${next}approved=1`);
}
