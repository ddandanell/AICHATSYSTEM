# Contact response desk — concept

Owns the open-conversation experience after the Phase 1 three-pane desk. Goal: open a contact and immediately see **time pressure**, an **AI answer ready to use**, and a **short path to correct + save** so you stop repeating yourself.

Implement on `cursor/inbox-three-pane-ui` (or a stacked follow-up). Do **not** auto-send. No DDL — compute from `mychef_inbox.messages`, `conversations`, `drafts`, `feedback`, `decision_records`, `knowledge`.

Related: [inbox-ux.md](./inbox-ux.md), [cbls-architecture.md](./cbls-architecture.md), [handoff.md](./handoff.md).

## Problem

Today the thread is mostly “read the chat and invent a reply.” That is slow and forgetful. You need:

1. Clock and SLA context at a glance.
2. An AI suggestion always on screen.
3. One click into “why this draft,” then a correction that **learns**.

## Top bar (always visible when a conversation is open)

One horizontal strip above the thread. One purpose: **time**.

| Metric | Meaning | How to compute (no new tables) |
|--------|---------|--------------------------------|
| **Started** | First inbound (or conversation create) | `min(messages.created_at)` for the conversation, Asia/Kuala_Lumpur label |
| **Waiting** | How long since *our* last outbound (or since last inbound if we never replied) | If last message is inbound → `now − last_inbound`. If we replied last → show “Waiting on guest” + time since our outbound |
| **Your avg reply** | Staff average response time on this thread | Mean of (first outbound after each inbound − that inbound), this conversation; fallback: last 30 days for this contact |
| **Guest avg reply** | Client average response time | Mean of (inbound after our outbound − that outbound) |
| **Last activity** | Absolute clock | `conversations.last_message_at` |

Display rules:

- Prefer **relative** for waiting (“14h”, “2d 3h”) plus absolute tooltip.
- Color waiting: calm under 4h, warn 4–24h, urgent >24h (CSS tokens only; no new palette).
- Empty averages → “—” with helper “Not enough turns yet.”

## Center: always-on AI suggestion

Never make the operator dig for a draft.

1. On open, if no pending draft → generate one (local drafter today; provider when key exists).
2. Sticky card under history: **AI suggested reply** + confidence.
3. Primary actions stay: Approve (ledger only until send is connected), Regenerate, Escalate.
4. Editing the draft opens the learning path (below). Sending remains off until product allows it.

## “How it came to this” + correct & learn

One control on the suggestion card: **How it came to this** → opens / focuses AI Brain (pane 3).

Show:

- Sources used (knowledge titles; click opens rule).
- Short reasoning paragraph (already on structured draft).
- Confidence and escalate flag.

When the human edits the draft (or clicks **Suggest how it should be**):

1. Pane switches to feedback (reason codes + why + “Remember this”).
2. Save creates/updates a pending `knowledge` row with `source = 'situational'` (or learning-pass mapping already used) — **not** auto-activated.
3. Optional: regenerate draft once with the new snippet included so the operator sees the correction stick.
4. Learning Queue remains the place to Approve / Dismiss permanently.

This is the anti-repetition loop: edit once → situational case → later retrieval uses it after approval.

## Client info still required

Keep Client Info tab: name, channel, tags, contact facts. Tag change still re-drafts (existing Phase 1 behavior).

## Mobile

Same data; stack as: time strip → history → sticky suggestion → sheet for “How it came to this” / feedback.

## Acceptance

- Open any `needs_reply` conversation: start date, waiting duration, both averages (or —) visible without scrolling away from the draft.
- AI suggestion card always present; if generation fails, show error state + Regenerate (no blank middle).
- “How it came to this” reveals sources + reasoning without leaving the desk.
- Edit → feedback → remember writes a pending situational row; curated 12 knowledge rows untouched; nothing sent.

## Out of scope here

WhatsApp send, production auto-send, Phase 3–5 roadmap items, changing login/keys.
