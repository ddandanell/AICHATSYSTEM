import { sql } from "drizzle-orm";
import { withKeyReader } from "@/db/tenant";
import { asBytea, decryptSecret } from "@/lib/crypto";
import type { Provider } from "@/lib/providers";

const TTL_MS = 45_000;

type CacheEntry = { secret: string; expires: number };

const globalForCache = globalThis as unknown as {
  byokCache?: Map<string, CacheEntry>;
};

const cache = globalForCache.byokCache ?? new Map<string, CacheEntry>();
globalForCache.byokCache = cache;

function cacheKey(orgId: string, provider: string) {
  return `${orgId}:${provider}`;
}

export function dropProviderSecret(orgId: string, provider: string) {
  cache.delete(cacheKey(orgId, provider));
}

export async function resolveProviderSecret(
  orgId: string,
  provider: Provider,
): Promise<string | null> {
  const key = cacheKey(orgId, provider);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.secret;
  if (hit) cache.delete(key);

  const secret = await withKeyReader(orgId, async (tx) => {
    const result = await tx.execute(
      sql`select encrypted_key from provider_credentials where provider = ${provider} and is_active = true limit 1`,
    );
    const row = result.rows[0] as { encrypted_key?: unknown } | undefined;
    if (!row?.encrypted_key) return null;
    return decryptSecret(asBytea(row.encrypted_key));
  });

  if (!secret) return null;
  cache.set(key, { secret, expires: Date.now() + TTL_MS });
  return secret;
}
