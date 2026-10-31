import { and, eq } from "drizzle-orm";
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
): Promise<{ ok: true; hint: string } | { ok: false; error: string }> {
  const trimmed = secret.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Enter the provider key. It stays on the server." };
  }
  const hint = keyHint(trimmed);
  const encrypted = encryptSecret(trimmed);
  try {
    await withTenant(orgId, async (tx) => {
      await tx.insert(providerCredentials).values({
        orgId,
        provider,
        encryptedKey: encrypted,
        keyHint: hint,
        isActive: true,
        createdBy: userId,
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
