/**
 * Save and list provider keys. Neon table: integration_connections. Do not auto-send.
 */
import { and, eq } from "drizzle-orm";
import { listMychefKeys, revokeMychefKey, saveMychefKey } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { withTenant } from "@/db/tenant";
import { providerCredentials } from "@/db/schema";
import { encryptSecret, keyHint } from "@/lib/crypto";
import { dropProviderSecret } from "@/lib/secrets";
import { type Provider } from "@/lib/providers";

function isUniqueViolation(error: unknown): boolean {
  const queue = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if ("code" in current && current.code === "23505") return true;
    if ("cause" in current) queue.push(current.cause);
  }
  return false;
}

const publicColumns = {
  id: providerCredentials.id,
  provider: providerCredentials.provider,
  keyHint: providerCredentials.keyHint,
  baseUrl: providerCredentials.baseUrl,
  isActive: providerCredentials.isActive,
  createdAt: providerCredentials.createdAt,
  rotatedAt: providerCredentials.rotatedAt,
};

function cleanBaseUrl(
  provider: Provider,
  raw: string | null | undefined,
): { ok: true; baseUrl: string | null } | { ok: false; error: string } {
  if (provider !== "vercel_gateway") return { ok: true, baseUrl: null };
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, baseUrl: null };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter an https base URL for Vercel AI Gateway." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "The gateway base URL must use https." };
  }
  return { ok: true, baseUrl: url.toString().replace(/\/$/, "") };
}

export async function listCredentials(orgId: string) {
  if (usesMychefInbox()) {
    const rows = await listMychefKeys();
    return rows.map((row) => ({
      id: row.id,
      provider: row.id as Provider,
      keyHint: row.config?.hint ?? null,
      baseUrl: row.config?.base_url ?? null,
      isActive: row.enabled,
      createdAt: row.updated_at,
      rotatedAt: null as Date | null,
      verifiedAt: row.verified_at,
      lastError: row.last_error,
    }));
  }
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select(publicColumns)
      .from(providerCredentials)
      .orderBy(providerCredentials.provider);
    return rows.map((row) => ({
      ...row,
      verifiedAt: null as Date | null,
      lastError: null as string | null,
    }));
  });
}

export async function saveCredential(
  orgId: string,
  userId: string,
  provider: Provider,
  secret: string,
  baseUrl?: string | null,
): Promise<{ ok: true; hint: string } | { ok: false; error: string }> {
  const trimmed = secret.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Enter the provider key. It stays on the server." };
  }
  const hint = keyHint(trimmed);
  const encrypted = encryptSecret(trimmed);
  const base = cleanBaseUrl(provider, baseUrl);
  if (!base.ok) return base;
  if (usesMychefInbox()) {
    const saved = await saveMychefKey(provider, trimmed, base.baseUrl);
    dropProviderSecret(orgId, provider);
    return saved;
  }
  try {
    await withTenant(orgId, async (tx) => {
      await tx.insert(providerCredentials).values({
        orgId,
        provider,
        encryptedKey: encrypted,
        keyHint: hint,
        isActive: true,
        createdBy: userId,
        ...(base.baseUrl ? { baseUrl: base.baseUrl } : {}),
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "This workspace already has a key for that provider. Rotate it instead.",
      };
    }
    throw error;
  }
  dropProviderSecret(orgId, provider);
  return { ok: true, hint };
}

export async function rotateCredential(
  orgId: string,
  provider: Provider,
  secret: string,
): Promise<{ ok: true; hint: string } | { ok: false; error: string }> {
  const trimmed = secret.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Enter the replacement key." };
  }
  const hint = keyHint(trimmed);
  const encrypted = encryptSecret(trimmed);
  if (usesMychefInbox()) {
    const saved = await saveMychefKey(provider, trimmed, null, true);
    dropProviderSecret(orgId, provider);
    return saved;
  }
  const updated = await withTenant(orgId, async (tx) => {
    return tx
      .update(providerCredentials)
      .set({
        encryptedKey: encrypted,
        keyHint: hint,
        isActive: true,
        rotatedAt: new Date(),
      })
      .where(
        and(
          eq(providerCredentials.orgId, orgId),
          eq(providerCredentials.provider, provider),
        ),
      )
      .returning({ id: providerCredentials.id });
  });
  if (updated.length === 0) {
    return { ok: false, error: "No key is stored for that provider yet." };
  }
  dropProviderSecret(orgId, provider);
  return { ok: true, hint };
}

export async function revokeCredential(
  orgId: string,
  provider: Provider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (usesMychefInbox()) {
    const revoked = await revokeMychefKey(provider);
    dropProviderSecret(orgId, provider);
    return revoked;
  }
  const updated = await withTenant(orgId, async (tx) => {
    return tx
      .update(providerCredentials)
      .set({ isActive: false })
      .where(
        and(
          eq(providerCredentials.orgId, orgId),
          eq(providerCredentials.provider, provider),
        ),
      )
      .returning({ id: providerCredentials.id });
  });
  if (updated.length === 0) {
    return { ok: false, error: "No key is stored for that provider." };
  }
  dropProviderSecret(orgId, provider);
  return { ok: true };
}
