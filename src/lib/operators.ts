/**
 * Approved console operators for Inbox mychef.
 *
 * - Approved owner email is seeded as bali@mychef.id (see OPERATOR_BOOTSTRAP_*).
 * - Passwords are scrypt hashes only — never log or return plaintext.
 * - Stored on mychef_inbox.integration_connections as id `operator:<email>`,
 *   kind `ai`, config.purpose `operator`. Not a provider BYOK row.
 * - Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { appPool } from "@/db/client";
import { userIdFromEmail, usesMychefInbox } from "@/db/mode";

const WORKSPACE = "mychef";
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const PREFIX = "operator:";

function scryptHash(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

export type OperatorRole = "owner" | "admin" | "reviewer" | "viewer";

export type OperatorPublic = {
  id: string;
  email: string;
  name: string;
  role: OperatorRole;
  approved: boolean;
  enabled: boolean;
  updatedAt: Date;
};

function operatorId(email: string) {
  return `${PREFIX}${email.trim().toLowerCase()}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptHash(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scryptHash(password, salt, expected.length, {
    N: n,
    r,
    p,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function roleOf(value: unknown): OperatorRole {
  if (value === "admin" || value === "reviewer" || value === "viewer" || value === "owner") {
    return value;
  }
  return "reviewer";
}

let bootstrapReady = false;

export async function ensureBootstrapOperator(): Promise<void> {
  if (!usesMychefInbox()) return;
  if (bootstrapReady) return;
  const email = normalizeEmail(process.env.OPERATOR_BOOTSTRAP_EMAIL || "bali@mychef.id");
  const password = process.env.OPERATOR_BOOTSTRAP_PASSWORD ?? "";
  const name = (process.env.OPERATOR_BOOTSTRAP_NAME || "Bali").trim() || "Bali";
  if (!password || password.length < 8) return;

  const id = operatorId(email);
  const existing = await appPool.query<{
    encrypted_secret: string;
    enabled: boolean;
    config: { purpose?: string; approved?: boolean } | null;
  }>(
    `select encrypted_secret, enabled, config
     from mychef_inbox.integration_connections
     where workspace_id = $1 and id = $2`,
    [WORKSPACE, id],
  );
  const row = existing.rows[0];
  // Already seeded and approved — skip re-hash when the bootstrap password still matches.
  if (
    row?.encrypted_secret?.startsWith("scrypt$") &&
    row.enabled &&
    row.config?.purpose === "operator" &&
    row.config?.approved === true
  ) {
    const ok = await verifyPassword(password, row.encrypted_secret);
    if (ok) {
      bootstrapReady = true;
      return;
    }
  }

  const hashed = await hashPassword(password);
  await appPool.query(
    `insert into mychef_inbox.integration_connections
       (workspace_id, id, kind, label, encrypted_secret, config, enabled, updated_at)
     values ($1, $2, 'ai', $3, $4, $5::jsonb, true, now())
     on conflict (workspace_id, id) do update
       set encrypted_secret = excluded.encrypted_secret,
           config = excluded.config,
           enabled = true,
           label = excluded.label,
           updated_at = now()`,
    [
      WORKSPACE,
      id,
      `Operator ${name}`,
      hashed,
      JSON.stringify({
        purpose: "operator",
        email,
        name,
        approved: true,
        role: "owner",
      }),
    ],
  );
  bootstrapReady = true;
}

export async function verifyOperator(
  email: string,
  password: string,
): Promise<{ email: string; name: string; role: OperatorRole; userId: string } | null> {
  if (!usesMychefInbox()) return null;
  await ensureBootstrapOperator();
  const normalized = normalizeEmail(email);
  if (!normalized || password.length < 1) return null;
  const result = await appPool.query<{
    encrypted_secret: string;
    enabled: boolean;
    config: {
      purpose?: string;
      email?: string;
      name?: string;
      approved?: boolean;
      role?: string;
    } | null;
  }>(
    `select encrypted_secret, enabled, config
     from mychef_inbox.integration_connections
     where workspace_id = $1 and id = $2 and kind = 'ai'`,
    [WORKSPACE, operatorId(normalized)],
  );
  const row = result.rows[0];
  if (!row?.enabled) return null;
  if (row.config?.purpose !== "operator") return null;
  if (row.config?.approved !== true) return null;
  if (!row.encrypted_secret?.startsWith("scrypt$")) return null;
  const ok = await verifyPassword(password, row.encrypted_secret);
  if (!ok) return null;
  return {
    email: normalized,
    name: row.config?.name || normalized.split("@")[0] || "Operator",
    role: roleOf(row.config?.role),
    userId: userIdFromEmail(normalized),
  };
}

export async function listOperators(): Promise<OperatorPublic[]> {
  if (!usesMychefInbox()) return [];
  await ensureBootstrapOperator();
  const result = await appPool.query<{
    id: string;
    enabled: boolean;
    updated_at: Date;
    config: {
      purpose?: string;
      email?: string;
      name?: string;
      approved?: boolean;
      role?: string;
    } | null;
  }>(
    `select id, enabled, updated_at, config
     from mychef_inbox.integration_connections
     where workspace_id = $1
       and kind = 'ai'
       and id like 'operator:%'
     order by id`,
    [WORKSPACE],
  );
  return result.rows
    .filter((row) => row.config?.purpose === "operator")
    .map((row) => {
      const email = row.config?.email || row.id.slice(PREFIX.length);
      return {
        id: row.id,
        email,
        name: row.config?.name || email,
        role: roleOf(row.config?.role),
        approved: row.config?.approved === true,
        enabled: row.enabled === true,
        updatedAt: row.updated_at,
      };
    });
}

export async function upsertOperator(input: {
  email: string;
  name: string;
  password: string;
  role: OperatorRole;
  approved: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!usesMychefInbox()) return { ok: false, error: "Operators live on the myCHEF inbox." };
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (input.password.trim().length < 8) {
    return { ok: false, error: "Use a password with at least 8 characters." };
  }
  const hashed = await hashPassword(input.password);
  const name = input.name.trim() || email.split("@")[0] || "Operator";
  await appPool.query(
    `insert into mychef_inbox.integration_connections
       (workspace_id, id, kind, label, encrypted_secret, config, enabled, updated_at)
     values ($1, $2, 'ai', $3, $4, $5::jsonb, $6, now())
     on conflict (workspace_id, id) do update
       set encrypted_secret = excluded.encrypted_secret,
           config = excluded.config,
           enabled = excluded.enabled,
           label = excluded.label,
           updated_at = now()`,
    [
      WORKSPACE,
      operatorId(email),
      `Operator ${name}`,
      hashed,
      JSON.stringify({
        purpose: "operator",
        email,
        name,
        approved: input.approved === true,
        role: input.role,
      }),
      input.approved === true,
    ],
  );
  return { ok: true };
}

export async function setOperatorApproved(
  email: string,
  approved: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!usesMychefInbox()) return { ok: false, error: "Operators live on the myCHEF inbox." };
  const normalized = normalizeEmail(email);
  const id = operatorId(normalized);
  const existing = await appPool.query<{ config: Record<string, unknown> | null }>(
    `select config from mychef_inbox.integration_connections
     where workspace_id = $1 and id = $2 and kind = 'ai'`,
    [WORKSPACE, id],
  );
  const row = existing.rows[0];
  if (!row || row.config?.purpose !== "operator") {
    return { ok: false, error: "That operator is not in this workspace." };
  }
  if (normalized === "bali@mychef.id" && !approved) {
    return { ok: false, error: "The approved owner cannot be revoked from this console." };
  }
  const config = {
    ...row.config,
    purpose: "operator",
    email: normalized,
    approved: approved === true,
  };
  await appPool.query(
    `update mychef_inbox.integration_connections
     set config = $3::jsonb, enabled = $4, updated_at = now()
     where workspace_id = $1 and id = $2`,
    [WORKSPACE, id, JSON.stringify(config), approved === true],
  );
  return { ok: true };
}

export function isOperatorConnectionId(id: string) {
  return id.startsWith(PREFIX);
}
