export const PROVIDERS = [
  "openai",
  "anthropic",
  "azure_openai",
  "bedrock",
  "google",
  "vercel_gateway",
  "deepseek",
] as const;

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
