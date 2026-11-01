# MyChef AI Operations Inbox — UX brief

Desktop-first 3-pane inbox for high-volume catering and private chef inquiries. Familiar like Gmail or Intercom, with AI draft, why, and a fast feedback loop.

## Layout

Full-height three columns.

### Pane 1 — Message queue (25%)

- Search; filters: All, Needs Review, Auto-Sent, Escalated.
- Card: customer name (bold if unread), 1-line snippet, timestamp, category badges (Private Chef blue, Catering purple, VIP gold), AI status dot (green high confidence, yellow low).
- Active row: background + left accent border.

### Pane 2 — Workspace (45%)

- Top: chat history — customer left, MyChef right.
- Middle: AI suggestion card — “AI Suggested Reply (Confidence: N%)”, editable rich text.
- Sticky actions: Approve & Send, Regenerate, Escalate to Human.
- Typing turns the draft border blue (manual edit in progress).

### Pane 3 — Context & intelligence (30%)

Tabs: Client Info | AI Brain.

**Client Info:** phone, email, address, past events/spend, tag pills. Changing a tag re-fetches knowledge for that category and shows “Updating AI knowledge…” then regenerates the draft.

**AI Brain:** sources used (click opens full rule), reasoning paragraph, feedback form after an edit: pill reason codes, why edit, “Remember this for next time” checkbox.

## Workflows

- Happy path: open → check sources → Cmd+Enter approve → next message loads.
- Learning path: edit draft → right pane switches to feedback → reason + why → Approve & Send.
- Tag routing: add Catering (or similar) → reload knowledge for that group → new draft.

## Rules

- Shortcuts: J/K list, A approve, E edit, Cmd+Enter submit.
- Customer message gray; AI draft white with subtle border; human edit highlighted.
- Approve animation: item fades, next slides up.
- Mobile: list full screen; detail slides in; context/feedback as bottom sheet. No three panes on phone.

## Principle

AI is a junior employee. Right pane is the manager view. Approve a good draft in under 3 seconds; correct a bad one in under 10.
