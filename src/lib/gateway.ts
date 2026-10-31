import { markMychefKeyChecked, resolveMychefSecret } from "@/data/mychef-store";
import { usesMychefInbox } from "@/db/mode";
import { withTenant } from "@/db/tenant";
import { aiUsageLog } from "@/db/schema";
import { DEEPSEEK_BASE, VERCEL_GATEWAY_DEFAULT, type Provider } from "@/lib/providers";
import { cachedProviderBaseUrl, resolveProviderSecret } from "@/lib/secrets";

const NO_KEY = "No active key stored for this provider.";

class SafeProviderError extends Error {}

function redact(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join("[redacted]");
}

function gatewayBase(provider: Provider, baseUrl: string | null): string {
  if (provider === "vercel_gateway") {
    return (baseUrl || VERCEL_GATEWAY_DEFAULT).replace(/\/$/, "");
  }
  if (provider === "deepseek") return DEEPSEEK_BASE;
  return "";
}

async function probe(provider: Provider, secret: string, baseUrl: string | null): Promise<void> {
  if (provider === "azure_openai") {
    throw new SafeProviderError(
      "Azure OpenAI needs an endpoint, which this slice does not store. The key was not sent.",
    );
  }
  if (provider === "bedrock") {
    throw new SafeProviderError(
      "Amazon Bedrock needs region and request signing, which this slice does not store. The key was not sent.",
    );
  }

  const headers = new Headers();
  let url = "";
  if (provider === "openai") {
    url = "https://api.openai.com/v1/models";
    headers.set("Authorization", `Bearer ${secret}`);
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/models";
    headers.set("x-api-key", secret);
    headers.set("anthropic-version", "2023-06-01");
  } else if (provider === "vercel_gateway" || provider === "deepseek") {
    url = `${gatewayBase(provider, baseUrl)}/models`;
    headers.set("Authorization", `Bearer ${secret}`);
  } else {
    url = "https://generativelanguage.googleapis.com/v1beta/models";
    headers.set("x-goog-api-key", secret);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new SafeProviderError("Could not reach the provider.");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SafeProviderError("The provider rejected the key.");
    }
    throw new SafeProviderError(`The provider returned status ${response.status}.`);
  }
}

export async function testProviderConnection(
  orgId: string,
  provider: Provider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stored = usesMychefInbox() ? await resolveMychefSecret(provider) : null;
  const secret = stored?.secret ?? (await resolveProviderSecret(orgId, provider));
  if (!secret) return { ok: false, error: NO_KEY };
  const baseUrl = stored?.baseUrl ?? cachedProviderBaseUrl(orgId, provider);

  try {
    await probe(provider, secret, baseUrl);
  } catch (error) {
    const message =
      error instanceof SafeProviderError
        ? error.message
        : "The provider call failed.";
    const safe = redact(message, secret);
    if (usesMychefInbox()) await markMychefKeyChecked(provider, safe);
    return { ok: false, error: safe };
  }

  if (usesMychefInbox()) {
    await markMychefKeyChecked(provider, null);
    return { ok: true };
  }

  await withTenant(orgId, async (tx) => {
    await tx.insert(aiUsageLog).values({
      orgId,
      provider,
      model: null,
      inputTokens: null,
      outputTokens: null,
    });
  });

  return { ok: true };
}
