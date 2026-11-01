# MyChef: Case-Based Learning System (CBLS)

The AI is an Operations Manager that learns situational nuance. When a human edits a draft, the system captures the reasoning, proposes a Situational Case Snippet, and after approval retrieves that case the next time a similar message arrives.

## Loop

1. Inbound via GoHighLevel.
2. Retrieve global rules + situational cases; draft with confidence.
3. Inbox review.
4. On edit: reason code + why (required for learning).
5. Immutable decision ledger (draft, final, reason, why, tags).
6. Nightly cron clusters edits by reason code and tag.
7. Learning Queue proposes a situational snippet with AI vs human diff.
8. Human Approves or Dismisses. Approved snippets are embedded into knowledge.
9. Similar future messages retrieve the snippet; high confidence can move to auto-pilot later.

## Inbox (see also inbox-ux.md)

- Left: queue with name, tag, confidence.
- Middle: history + AI draft banner (“Based on Case #…”) + Approve / Regenerate / Escalate. Edit turns border blue and switches right pane to Why.
- Right: CRM (tags trigger knowledge re-fetch) | AI Brain (sources, reasoning, feedback pills, save-to-knowledge toggle).
- Diff before send: strikethrough deleted AI text, highlight human additions.
- Shortcuts: J/K, A, E, Cmd+Enter. Mobile: list → detail → bottom sheet.

## Learning Queue

Cards: proposed snippet, evidence diff, Approve Snippet / Dismiss. Group by Missing Knowledge, Tone, Outdated, Suggested. Idempotent cron (`processed_for_learning`).

## Data (conceptual; map onto Neon mychef_inbox)

- Global rules / knowledge.
- Situational cases: context_tag, content, embedding, source_decision_ids.
- Decision ledger: inbound, draft, final, decision, reason_code, why, tags, confidence, sources.

## Retrieval

Tag from CRM or classifier → vector search global rules + cases for that tag → structured JSON draft (why, confidence, sources). Workspace isolation on every query.

## Milestones

1. 3-pane inbox. 2. Why form. 3. Nightly cluster. 4. Learning Queue approve. 5. Tag-scoped retrieval. Auto-send only after acceptance is high.
