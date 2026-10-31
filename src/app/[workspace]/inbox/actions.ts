"use server";

import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/context";
import { createDraft } from "@/lib/draft";
import { canReview } from "@/lib/workspace-access";

export type DraftActionState = { error?: string } | null;

export async function draftAction(
  slug: string,
  _prev: DraftActionState,
  formData: FormData,
): Promise<DraftActionState> {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok") {
    return { error: "You cannot draft in this workspace." };
  }
  if (!canReview(access.ctx.role)) {
    return { error: "Your role can read the queue. A reviewer drafts a reply." };
  }

  const created = await createDraft(access.ctx.orgId, String(formData.get("inbound") ?? ""));
  if (!created.ok) return { error: created.error };
  redirect(`/${slug}/inbox/${created.id}`);
}
