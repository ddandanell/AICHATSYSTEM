import { withTenant } from "@/db/tenant";
import { aiUsageLog } from "@/db/schema";
import type { Provider } from "@/lib/providers";
import { resolveProviderSecret } from "@/lib/secrets";

const NO_KEY = "No active key stored for this provider.";

class SafeProviderError extends Error {}

function redact(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join("[redacted]");
}

async function probe(provider: Provider, secret: string): Promise<void> {
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
  const secret = await resolveProviderSecret(orgId, provider);
  if (!secret) return { ok: false, error: NO_KEY };

  try {
    await probe(provider, secret);
  } catch (error) {
    const message =
      error instanceof SafeProviderError
        ? error.message
        : "The provider call failed.";
    return { ok: false, error: redact(message, secret) };
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
