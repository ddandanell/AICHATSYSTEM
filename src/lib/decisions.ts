import { and, desc, eq } from "drizzle-orm";
import { withTenant } from "@/db/tenant";
import {
  decisionRecords,
  feedbackEvents,
  rawMessages,
  type SourceMark,
  type SourceRef,
} from "@/db/schema";
import type { HumanDecision } from "@/lib/reason-codes";

export async function listDecisions(
  orgId: string,
  status: "pending_review" | "reviewed",
) {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({
        id: decisionRecords.id,
        draftText: decisionRecords.draftText,
        finalText: decisionRecords.finalText,
        confidence: decisionRecords.confidence,
        status: decisionRecords.status,
        humanDecision: decisionRecords.humanDecision,
        reasonCode: decisionRecords.reasonCode,
        createdAt: decisionRecords.createdAt,
        inboundBody: rawMessages.body,
        receivedAt: rawMessages.receivedAt,
      })
      .from(decisionRecords)
      .innerJoin(rawMessages, eq(rawMessages.id, decisionRecords.inboundMessageId))
      .where(eq(decisionRecords.status, status))
      .orderBy(desc(decisionRecords.createdAt));
  });
}

export async function getDecision(orgId: string, id: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: decisionRecords.id,
        orgId: decisionRecords.orgId,
        draftText: decisionRecords.draftText,
        finalText: decisionRecords.finalText,
        actionTaken: decisionRecords.actionTaken,
        rationale: decisionRecords.rationale,
        whyNot: decisionRecords.whyNot,
        rejectedAlternative: decisionRecords.rejectedAlternative,
        reasonCode: decisionRecords.reasonCode,
        confidence: decisionRecords.confidence,
        sourceRefs: decisionRecords.sourceRefs,
        humanDecision: decisionRecords.humanDecision,
        status: decisionRecords.status,
        outcome: decisionRecords.outcome,
        outcomeAt: decisionRecords.outcomeAt,
        createdAt: decisionRecords.createdAt,
        inboundBody: rawMessages.body,
        receivedAt: rawMessages.receivedAt,
      })
      .from(decisionRecords)
      .innerJoin(rawMessages, eq(rawMessages.id, decisionRecords.inboundMessageId))
      .where(eq(decisionRecords.id, id))
      .limit(1);
    const decision = rows[0];
    if (!decision) return null;
    const feedback = await tx
      .select()
      .from(feedbackEvents)
      .where(eq(feedbackEvents.decisionRecordId, id))
      .orderBy(desc(feedbackEvents.createdAt));
    return { ...decision, feedback };
  });
}

export async function countDecisions(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ id: decisionRecords.id, orgId: decisionRecords.orgId })
      .from(decisionRecords);
    return rows;
  });
}

export type ReviewInput = {
  humanDecision: HumanDecision;
  reasonCode: string;
  rationale: string;
  whyNot: string;
  finalText: string;
  sourceMarks: SourceMark[];
};

export async function saveReview(
  orgId: string,
  actorId: string,
  decisionId: string,
  input: ReviewInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(orgId, async (tx) => {
    const existing = await tx
      .select({
        id: decisionRecords.id,
        draftText: decisionRecords.draftText,
        status: decisionRecords.status,
        sourceRefs: decisionRecords.sourceRefs,
      })
      .from(decisionRecords)
      .where(eq(decisionRecords.id, decisionId))
      .limit(1);
    const row = existing[0];
    if (!row) return { ok: false, error: "That draft is not in this workspace." };
    if (row.status !== "pending_review") {
      return { ok: false, error: "This draft was already reviewed." };
    }

    let finalText: string | null = null;
    let rejectedAlternative: string | null = null;
    if (input.humanDecision === "accepted") {
      if (input.finalText.trim() !== row.draftText.trim()) {
        return {
          ok: false,
          error:
            "Accepted replies keep the draft text. Choose Edited if you changed it.",
        };
      }
      finalText = row.draftText;
    } else if (input.humanDecision === "edited") {
      if (!input.finalText.trim() || input.finalText.trim() === row.draftText.trim()) {
        return {
          ok: false,
          error: "Edited replies need a final text that differs from the draft.",
        };
      }
      finalText = input.finalText.trim();
      rejectedAlternative = row.draftText;
    } else {
      rejectedAlternative = row.draftText;
    }

    const updated = await tx
      .update(decisionRecords)
      .set({
        finalText,
        actionTaken: input.humanDecision,
        rationale: input.rationale,
        whyNot: input.whyNot,
        rejectedAlternative,
        reasonCode: input.reasonCode,
        humanDecision: input.humanDecision,
        status: "reviewed",
      })
      .where(
        and(
          eq(decisionRecords.id, decisionId),
          eq(decisionRecords.status, "pending_review"),
        ),
      )
      .returning({ id: decisionRecords.id });
    if (updated.length === 0) {
      return { ok: false, error: "This draft was already reviewed." };
    }

    await tx.insert(feedbackEvents).values({
      orgId,
      decisionRecordId: decisionId,
      actorId,
      humanDecision: input.humanDecision,
      reasonCode: input.reasonCode,
      rationale: input.rationale,
      whyNot: input.whyNot,
      sourceMarks: input.sourceMarks,
    });

    return { ok: true };
  });
}

export function citedIds(sourceRefs: SourceRef[] | null): string[] {
  return (sourceRefs ?? []).map((ref) => ref.id);
}
