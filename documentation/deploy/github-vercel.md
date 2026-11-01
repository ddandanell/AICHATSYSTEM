# GitHub + Vercel deploy

Canonical GitHub: [numini-co/inbox-mychef](https://github.com/numini-co/inbox-mychef)

Preferred production tip: branch `cursor/decision-ledger-console-d800` (do not force-update `main` without reason).

## Clone from GitHub

```bash
git clone https://github.com/numini-co/inbox-mychef.git
cd inbox-mychef
git checkout cursor/decision-ledger-console-d800
npm install
cp .env.example .env.local
# Fill required names in .env.local — never commit that file
npm run dev
```

Node.js 20.9+ (repo pins `.nvmrc` → 22). See root [README.md](../../README.md) and [LOCAL.md](../../LOCAL.md).

## Link Vercel to GitHub (preferred)

Once Numini team SSO/MCP consent is done:

1. Open https://vercel.com/new on team **Numini** (`team_fVzrn4d5I1giSnLrnwsiBC1S`).
2. Import **GitHub** `numini-co/inbox-mychef` (not a personal fork).
3. Framework: **Next.js** (also set in `vercel.json`).
4. Production branch: `cursor/decision-ledger-console-d800`.
5. Root directory: `.` · Install: `npm ci` · Build: `npm run build`.
6. Region: `sin1` (Singapore — matches Neon `ap-southeast-1`).
7. Env (Production + Preview), names only — values in Vercel UI:

| Required | Optional |
| --- | --- |
| `DATABASE_URL` | `CRON_SECRET` |
| `KEY_READER_DATABASE_URL` | `GHL_WEBHOOK_SECRET` |
| `AUTH_SECRET` | |
| `BYOK_ENCRYPTION_KEY` | |
| `AUTH_URL` (= deployment origin) | |
| `OPERATOR_BOOTSTRAP_EMAIL` | |
| `OPERATOR_BOOTSTRAP_PASSWORD` | |

8. Deploy. Later pushes to the production branch auto-deploy via Vercel Git integration.

Permanent project creation waits on user Vercel MCP + Numini SSO. A claimable temp deploy already proved Neon connectivity.

## GitHub Actions

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `npm ci` + `npm run build` on pushes/PRs. It does **not** deploy. Ship with Vercel Git integration after the project is linked.

## Agent / Origin note

Cursor agents push to Origin first. Mirror the same tip to GitHub when `GITHUB_TOKEN` / MCP Contents write is available. Leave `main` alone unless there is an explicit reason to move it.
