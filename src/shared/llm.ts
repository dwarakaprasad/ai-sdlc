/** The LLM providers the Parent can choose from, shared by the server's checks and the settings form. */
export const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    /** The only place the adapter reads its key from (ADR 0002). */
    envVar: "ANTHROPIC_API_KEY",
    /** Offered as suggestions; the Parent may type any model id the provider accepts. */
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"],
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const DEFAULT_LLM_SETTINGS = { provider: "anthropic", model: "claude-opus-5-5" } as const satisfies {
  provider: ProviderId;
  model: string;
};

export function isProviderId(id: unknown): id is ProviderId {
  return PROVIDERS.some((p) => p.id === id);
}

export function providerInfo(id: ProviderId) {
  return PROVIDERS.find((p) => p.id === id)!;
}

/**
 * Why an LLM call failed, in terms the Parent can act on:
 * the key's environment variable is unset, the provider rejected the key, the provider doesn't know the model,
 * or anything else (network, outage, refusal, unparseable reply).
 */
export type LlmErrorKind = "missingKey" | "rejectedKey" | "unknownModel" | "failed";
