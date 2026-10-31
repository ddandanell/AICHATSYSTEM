/**
 * Nightly learning loop. Not implemented in this slice.
 *
 * Per organization, when the job exists:
 * 1. Load feedback_events since the last run.
 * 2. Group by reason_code.
 * 3. Diagnose:
 *    - wrong_policy, wrong_fact, missing_knowledge → knowledge gap. Propose a position edit.
 *    - too_formal, too_casual, should_have_asked, missed_upsell, customer_angry → procedure gap. Propose a playbook edit.
 *    - needs_human → escalation rule candidate.
 *    - irrelevant_source → retrieval penalty on that source id.
 *    - good_as_drafted → count as evidence for the sources used. Do not propose an edit.
 * 4. Write one rules row per proposal, status = candidate, evidence_count = size of the group. Do not activate it.
 * 5. A human sets active or deprecated. Activation requires the proposal diff and the evidence count to be visible.
 * 6. Decay: an active rule with no supporting feedback for 90 days becomes deprecated.
 */
export function runNightlyLearningLoop(): Promise<never> {
  return Promise.reject(
    new Error("The nightly learning loop is not implemented in this slice."),
  );
}
