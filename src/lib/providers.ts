/**
 * BYOK provider ids. Prefer Vercel AI Gateway and DeepSeek first.
 * Keys are encrypted server-side; never log secrets.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
export const PROVIDERS = [
  "vercel_gateway",
  "deepseek",
  "openai",
  "anthropic",
  "google",
  "azure_openai",
  "bedrock",
] as const;

export const VERCEL_GATEWAY_DEFAULT = "https://ai-gateway.vercel.sh/v1";
export const DEEPSEEK_BASE = "https://api.deepseek.com";

export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  vercel_gateway: "Vercel AI Gateway",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  azure_openai: "Azure OpenAI",
  bedrock: "Amazon Bedrock",
};

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}
