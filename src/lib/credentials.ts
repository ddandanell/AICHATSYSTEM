import { and, eq } from "drizzle-orm";
import { listMychefKeys, revokeMychefKey, saveMychefKey } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { withTenant } from "@/db/tenant";
import { providerCredentials } from "@/db/schema";
import { encryptSecret, keyHint } from "@/lib/crypto";
import { dropProviderSecret } from "@/lib/secrets";
import type { Provider } from "@/lib/providers";

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
  isActive: providerCredentials.isActive,
  createdAt: providerCredentials.createdAt,
  rotatedAt: providerCredentials.rotatedAt,
};

export async function listCredentials(orgId: string) {
  if (usesMychefInbox()) {
    const rows = await listMychefKeys();
    return rows.map((row) => ({
      id: row.id,
      provider: row.id as Provider,
      keyHint: row.config?.hint ?? null,
      isActive: row.enabled,
      createdAt: row.updated_at,
      rotatedAt: null as Date | null,
    }));
  }
  return withTenant(orgId, async (tx) => {
    return tx
      .select(publicColumns)
      .from(providerCredentials)
      .orderBy(providerCredentials.provider);
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
  if (usesMychefInbox()) {
    const saved = await saveMychefKey(provider, trimmed, baseUrl ?? null);
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
        ...(baseUrl ? { baseUrl } : {}),
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
    const saved = await saveMychefKey(provider, trimmed, null);
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
