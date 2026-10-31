export const PROVIDERS = [
  "openai",
  "anthropic",
  "azure_openai",
  "bedrock",
  "google",
] as const;

export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure_openai: "Azure OpenAI",
  bedrock: "Amazon Bedrock",
  google: "Google",
};

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}
