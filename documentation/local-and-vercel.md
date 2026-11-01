# Run MyChef locally + on Vercel

## Why the cloud desktop feels slow

The app runs on a remote agent VM. For fast testing, run it on your Mac or deploy to Vercel.

## A — Connect your Mac as a Cursor worker

On your Mac:

1. Install/update Cursor CLI: https://cursor.com/docs/cloud-agent/self-hosted/my-machines
2. `agent login`
3. `agent worker start`
4. Leave that terminal running, then tell this Project chat: “My machine is connected.”

### Manual local run

```bash
git clone https://github.com/numini-co/inbox-mychef.git
cd inbox-mychef
git checkout cursor/decision-ledger-console-d800
npm install
cp .env.example .env.local
# Set: DATABASE_URL, KEY_READER_DATABASE_URL, AUTH_SECRET, BYOK_ENCRYPTION_KEY,
#      AUTH_URL, OPERATOR_BOOTSTRAP_EMAIL, OPERATOR_BOOTSTRAP_PASSWORD
npm run dev
```

Open http://127.0.0.1:4317/login — `bali@mychef.id` + your password.

Use the Neon `mychef` pooled connection string you already shared (gitignored only).

## B — Vercel

Canonical GitHub: https://github.com/numini-co/inbox-mychef

Preferred tip: `cursor/decision-ledger-console-d800` (do not force-update `main` without reason).

Permanent Numini project create waits on **user Vercel MCP + Numini SSO**. Until then, use the claimable temp deploy that already proved Neon, or import the GitHub repo manually after SSO.

Full checklist: [deploy/github-vercel.md](./deploy/github-vercel.md).

On https://vercel.com/new (team **Numini**):

1. Import GitHub `numini-co/inbox-mychef`.
2. Production branch: `cursor/decision-ledger-console-d800`.
3. Framework: Next.js (`vercel.json` sets install/build + region `sin1`).
4. Env (Production + Preview): required names from `.env.example`. Set `AUTH_URL` to the deployment origin.
5. Deploy. Pushes to the production branch auto-deploy via Vercel Git integration.

## Do not

- Do not put secrets in git.
- Do not enable auto-send until you choose to.
