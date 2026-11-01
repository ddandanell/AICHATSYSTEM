# Inbox mychef — operational decision system

Turn client conversations into an operational decision system: draft replies, record why a reply is right or wrong, and get better through review instead of retraining from scratch.

Mental model: ChatGPT (or any LLM) is the reasoning engine. GoHighLevel (GHL) is the channel. MCP is the hands. The durable asset is the decision ledger, curated knowledge, and evaluation set.

Do not start with a marketing page. Define the decision record and the learning loop first. The console and database serve that.

## What not to do first

- Do not dump raw chats into a vector database and call it a knowledge base.
- Do not make MCP the memory. MCP is an integration and action layer.
- Do not let the model rewrite its own rules automatically on day one.
- Do not start fully automatic. Start as a draft copilot: a human approves, edits, or rejects every reply.

## Four stores

Even if they share one Postgres database at first, keep them separate.

### A. Immutable raw archive

Every imported conversation, GHL message, and draft is stored raw and immutable. Never edit the raw record. ChatGPT exports are raw material, not curated knowledge.

### B. Curated knowledge — declarative

Authoritative truth: policies, pricing, service boundaries, positions (“when X, stance is Y”), constraints, exceptions, definitions, escalation criteria.

Structured Markdown with YAML frontmatter:

```yaml
id: refund-policy-001
type: position
owner: support-lead
status: active
effective_from: 2026-11-01
depends_on: []
referenced_by: []
scope: billing
priority: high
```

### C. Procedural playbooks

How to decide, separate from what is true:

1. Classify intent.
2. Load positions and constraints.
3. Check disqualifiers and escalation triggers.
4. Choose reply strategy.
5. Draft.
6. State evidence and confidence.
7. Escalate if ambiguity or risk exceeds threshold.

### D. Decision ledger

Every drafted, sent, edited, or rejected reply writes a decision record: inbound message and context, draft, what the human sent, action, why, why not, sources, confidence, risk, later outcome.

```sql
create table decision_records (
  id uuid primary key,
  conversation_id uuid not null,
  inbound_message_id uuid not null,
  draft_text text not null,
  final_text text,
  action_taken text,
  rationale text,
  why_not text,
  rejected_alternative text,
  reason_code text,
  confidence numeric,
  source_refs jsonb,
  human_decision text check (human_decision in ('accepted','edited','rejected','escalated')),
  outcome text,
  outcome_at timestamptz,
  created_at timestamptz default now()
);
```

Also:

- `feedback_events` — corrections and approvals with structured reason codes.
- `rules` — candidate, active, or deprecated rules with scope, priority, exceptions, evidence count, owner, version.
- `eval_cases` — golden scenarios and expected behavior.
- `eval_runs` — regression results for prompt or knowledge changes.

If it is not in the ledger, it did not happen and cannot be learned from.

## Feedback (5–10 seconds)

1. Decision: Accepted / Edited / Rejected / Escalated.
2. Reason code (analytics), separate from free-text rationale.
3. Why this reply (short text).
4. Why not the alternative (short text).
5. Sources auto-attached; human can mark irrelevant or missing.
6. Outcome later (24–48h): booked, closed, refunded, no response, complaint, etc.

## Learning loop (later phases, do not build all now)

1. Better retrieval and structured knowledge from corrections.
2. Better playbooks when knowledge was right but the choice was wrong.
3. Retrieve similar high-quality decisions as examples.
4. Eval-gated changes against a golden set.
5. Fine-tuning only after thousands of high-quality records.
6. Automate only high-confidence, low-risk intents, with a human sample and escalation.

## GHL + MCP (later, not this slice)

Inbound: GHL webhook or poll → queue → orchestration. Context: contact, positions, playbook, similar decisions, account constraints. Draft: structured JSON (intent, action, draft, why, why not, confidence, sources, escalate). Action: human review, then a narrow tool sends.

Wrap MCP. Expose only narrow tools (`get_conversation`, `get_contact_context`, `search_knowledge`, `get_similar_decisions`, `create_draft`, `send_reply`, `tag_conversation`, `create_task`, `escalate_to_human`). MCP is not the event system.

## First slice to build now (Phase 1 system of record)

Stack: Next.js, TypeScript, Tailwind, shadcn/ui. Postgres for the ledger (local Postgres via docker-compose is fine; ship a runnable path without cloud credentials). Knowledge and playbooks as Markdown + YAML in the repo, versioned. No GHL, no MCP, no automatic sending, no vector dump of chats.

The internal app is a Knowledge & Decision Console:

- A review queue of inbound messages with a draft.
- The 5–10 second feedback form (decision, reason code, why, why not, source relevance).
- Saving writes a decision record and a feedback event. Raw inbound text is immutable.
- A knowledge list that reads the position files and playbooks.
- Seed data: a handful of realistic client messages (billing / booking style) plus 10–20 example position files is too many for a first slice — ship 4–6 position files, 2 playbooks, and enough seeded decision records that the queue, an empty state, and a completed review are all visible.
- Eval cases table can exist in schema and show a short list; do not build the regression runner yet.

Run the dev server on an uncommon port (not 3000, 5173, or 8080), leave it running, and replace the seeded README with what this repo is and how to run it locally.

Open a pull request when the slice works.
