export const PROVIDERS = [
  "vercel_gateway",
  "deepseek",
  "openai",
  "anthropic",
  "google",
  "azure_openai",
  "bedrock",
] as const;

export const PRIMARY_PROVIDERS = ["vercel_gateway", "deepseek"] as const;

export const VERCEL_GATEWAY_DEFAULT = "https://ai-gateway.vercel.sh/v1";
export const DEEPSEEK_BASE = "https://api.deepseek.com";

export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure_openai: "Azure OpenAI",
  bedrock: "Amazon Bedrock",
  google: "Google",
  vercel_gateway: "Vercel AI Gateway",
  deepseek: "DeepSeek",
};

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function providerHost(provider: Provider): string | null {
  if (provider === "vercel_gateway") return VERCEL_GATEWAY_DEFAULT;
  if (provider === "deepseek") return DEEPSEEK_BASE;
  return null;
}
