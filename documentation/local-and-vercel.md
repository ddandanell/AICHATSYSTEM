# Run MyChef locally + on Vercel

## Why the cloud desktop feels slow

The app runs on a remote agent VM. For fast testing, run it on your Mac or deploy to Vercel.

## A — Connect your Mac as a Cursor worker (required for “set it up on my computer”)

No self-hosted worker is connected right now. On your Mac:

1. Install/update Cursor CLI: https://cursor.com/docs/cloud-agent/self-hosted/my-machines  
2. `agent login`  
3. `agent worker start`  
4. Leave that terminal running, then tell this Project chat: “My machine is connected.”

Once the worker shows as connected, an agent can clone the branch, write `.env.local`, and start `npm run dev` on your machine.

### Manual local run (if you already have the code)

```bash
git fetch origin
git checkout cursor/decision-ledger-console-d800
npm install
cp .env.example .env.local   # or create .env.local
# Set: DATABASE_URL, KEY_READER_DATABASE_URL, AUTH_SECRET, BYOK_ENCRYPTION_KEY
npm run dev -- -p 4317
```

Open http://127.0.0.1:4317/login — `bali@mychef.id` + your password.

Use the Neon `mychef` pooled connection string you already shared (gitignored only).

## B — Vercel

Attempted `create_git_project` / `create_project` on team Numini → **403 Forbidden**. MCP and CLI cannot create the project for you.

Deploy tip ready (build passes):

- Remote: `https://origin.cursor.com/git/team-numini/tmp-c3cb3faec518f5f4.git`
- Branch: `cursor/decision-ledger-console-d800`
- Tip SHA: `9fb96677ae422544a6da3a32877b676d62b6637a`

On https://vercel.com/new (team **Numini**):

1. Import Origin repo `team-numini/tmp-c3cb3faec518f5f4`.
2. Production branch: `cursor/decision-ledger-console-d800` (not empty `main`).
3. Framework: Next.js.
4. Env (Production + Preview): `DATABASE_URL`, `KEY_READER_DATABASE_URL`, `AUTH_SECRET`, `BYOK_ENCRYPTION_KEY`, `AUTH_URL` (= deployment origin). Optional: `CRON_SECRET`, `GHL_WEBHOOK_SECRET`.
5. Deploy. If Deployment Protection blocks you, disable it for the preview or use the share bypass.

After the project exists, paste the URL here so env + redeploys can be finished via tools.

## Do not

- Do not put secrets in git.
- Do not enable auto-send until you choose to.
