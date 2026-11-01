# Inbox mychef — documentation

Project docs for the myCHEF operations console (decision ledger, inbox desk, knowledge, keys).

## Repository

- **Source of truth:** Cursor Origin (this agent checkout). Do not point docs at a random `github.com/...` remote unless the project Create-repo flow created it.
- **Production:** `https://inbox-mychef-gilt.vercel.app` (Vercel). Redeploys follow the Origin branch the project is linked to.

## Start here

| Doc | Purpose |
|-----|---------|
| [roadmap.md](./roadmap.md) | Phase 1–5 product map (do not start Phase 3–5 early) |
| [todo.md](./todo.md) | Ordered build list |
| [handoff.md](./handoff.md) | Agent / engineer onboarding |
| [local-and-vercel.md](./local-and-vercel.md) | Local Mac + Vercel notes |

## Product UX

| Doc | Purpose |
|-----|---------|
| [inbox-ux.md](./inbox-ux.md) | Three-pane inbox brief |
| [inbox-design-system.md](./inbox-design-system.md) | shadcn desk contract (layout, tokens, spacing) |
| [contact-response-desk.md](./contact-response-desk.md) | Timers, always-on AI draft, correct→learn |
| [inbox-three-pane-shipped.md](./inbox-three-pane-shipped.md) | What Phase 1 desk already shipped |
| [cbls-architecture.md](./cbls-architecture.md) | Case-Based Learning |
| [learning-queue.md](./learning-queue.md) | Learning Queue operator notes |

## Architecture

| Doc | Purpose |
|-----|---------|
| [agent-spec.md](./agent-spec.md) | Schema, RLS, reason codes |
| [technical-blueprint.md](./technical-blueprint.md) | Stack, BYOK, multi-tenant |
| [architecture.md](./architecture.md) | Original four-store foundation |

## App README

How to run the app: see the root [README.md](../README.md).
