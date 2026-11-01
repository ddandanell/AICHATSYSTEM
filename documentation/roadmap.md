# MyChef AI Operations Console — Master Roadmap

Strategic goal: a proprietary, self-improving AI that handles inquiries, learns MyChef nuance, later manages menus, then business intelligence.

**Do not build Phase 3, 4, or 5 until Phase 1 and 2 are trustworthy.** Later phases are mapped so today’s schema and UI can grow into them.

## Phase 1 — Core engine & inbox (current)

Goal: AI drafts → human reviews → human corrects → system can learn.

- Decision ledger, knowledge, workspace isolation
- 3-pane Inbox (queue, draft, why)
- Knowledge editor + embeddings when owner DDL allows
- GHL webhook in; send only on approve
- Feedback form (reason + why)

## Phase 2 — Learning flywheel & localization (current / next)

Goal: self-improving + international clients.

- Multi-language: detect (e.g. Indonesian), show English to reviewer, reply in client language
- Learning Queue + CBLS situational snippets
- Tag-scoped retrieval (VIP, Catering, Vegan, …)
- Auto-pilot Tier 1: confidence slider; default OFF until trusted

## Phase 3 — Menu Engine & sales playbooks (later — do not start)

- Tables: menus, menu_courses, dishes
- Menu builder UI (courses, allergens, prices)
- AI dish/menu search via tools
- Lifecycle playbook buttons: official confirmation, polite goodbye, 3-day check-in
- WhatsApp-friendly menu formatting

## Phase 4 — Business intelligence & profitability (later — do not start)

- Analytics: volume, conversion, geo heatmaps
- Conversion pattern tags from closed deals
- Grocery costing / margin on dishes and events
- AI weekly insight box in plain English

## Phase 5 — Full autopilot & deep integration (later — do not start)

- Multi-turn WhatsApp/email automation
- Calendar availability + blocking
- PDF proposals + payment links (Stripe/GHL)

## Why this order

Brain and memory first (Phases 1–2). Menu and analytics only after the AI is trusted. Architecture today should leave hooks for channels, tags, and structured culinary data — without building those UIs yet.

See also: [Handoff](./handoff.md), [To-do](./todo.md), [CBLS](./cbls-architecture.md), [Inbox UX](./inbox-ux.md).
