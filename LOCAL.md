# Run on your Mac

No self-hosted Cursor worker is connected yet. Cloud agents cannot use this machine until you start one and leave it running:

```bash
agent worker start
```

Install the Cursor CLI first if `agent` is not on your PATH. That process is the worker. It does not start the inbox app.

## Clone

Node.js 20 or newer. Once this repo is accessible:

```bash
git clone https://origin.cursor.com/git/team-numini/tmp-c3cb3faec518f5f4.git inbox-mychef
cd inbox-mychef
git checkout cursor/decision-ledger-console-d800
npm install
cp .env.example .env.local
```

## Env

Edit `.env.local`. Do not commit it. Required names:

- `DATABASE_URL`
- `KEY_READER_DATABASE_URL`
- `AUTH_SECRET`
- `BYOK_ENCRYPTION_KEY`

Optional: `CRON_SECRET`, `GHL_WEBHOOK_SECRET`.

Generate the two keys (print them once, paste into `.env.local`, do not commit):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use the Neon `mychef_runtime` strings for `DATABASE_URL` and `KEY_READER_DATABASE_URL` if you want the live inbox. The role cannot create tables. Do not run `npm run db:setup` against Neon.

`.env.example` still has the local Docker URLs (`127.0.0.1:5433`). Those match `docker compose` only. For that path:

```bash
docker compose up -d
npm run db:setup
```

Set `OPERATOR_BOOTSTRAP_PASSWORD` in `.env.local` before the first Neon sign-in. The server stores a scrypt hash. The owner email is `bali@mychef.id`.

## App

```bash
npm run dev
```

Open http://127.0.0.1:4317, sign in at `/login`, then `/mychef/dashboard`.

Approving a draft writes the ledger. It does not message the guest. Auto-pilot stays off. Keys are at `/mychef/settings/keys`. Auto-pilot is at `/mychef/settings/autopilot`.

## Vercel

Same required env names on the Vercel project. Optional `CRON_SECRET` and `GHL_WEBHOOK_SECRET`. Set `AUTH_URL` to the deployment origin. Deploy branch `cursor/decision-ledger-console-d800`. `vercel.json` only adds the learning cron. Nothing in that cron sends a message.
