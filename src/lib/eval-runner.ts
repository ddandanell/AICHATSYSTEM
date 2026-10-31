/**
 * Runs local eval cases and writes ai_usage_log or audit rows. Do not auto-send.
 */
import { desc } from "drizzle-orm";
import { evalCases, evalRuns } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import { localStructuredDraft } from "@/lib/draft";
import { retrieveWithin } from "@/lib/retrieval";

export async function runWorkspaceEvals(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const cases = await tx.select().from(evalCases).orderBy(desc(evalCases.createdAt));
    const results: { id: string; name: string; passed: boolean; notes: string }[] = [];
    for (const item of cases) {
      const retrieved = await retrieveWithin(tx, orgId, item.inboundText, undefined, 8);
      const draft = localStructuredDraft(item.inboundText, retrieved.knowledge, retrieved.decisions);
      const include = item.mustInclude?.trim();
      const exclude = item.mustNotInclude?.trim();
      const hasInclude = !include || draft.draftText.toLowerCase().includes(include.toLowerCase());
      const hasExclude = Boolean(
        exclude && draft.draftText.toLowerCase().includes(exclude.toLowerCase()),
      );
      const passed = hasInclude && !hasExclude;
      const notes = passed
        ? "Draft matched the case. No provider was called."
        : `Draft missed the case. Include “${include ?? ""}”. Exclude “${exclude ?? ""}”.`;
      await tx.insert(evalRuns).values({
        orgId,
        evalCaseId: item.id,
        passed,
        notes,
      });
      results.push({ id: item.id, name: item.name, passed, notes });
    }
    return results;
  });
}

export async function latestEvalRuns(orgId: string) {
  return withTenant(orgId, async (tx) => {
    return tx.select().from(evalRuns).orderBy(desc(evalRuns.createdAt));
  });
}
