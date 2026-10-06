/**
 * The LLM provider interface (ADR 0002). The Tutor reaches a model only through this,
 * so adding a vendor means adding an adapter, never changing tutoring logic.
 */

import type { LlmErrorKind } from "../shared/llm";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Tokens one call used, as the provider reported them. */
export type TokenUsage = { inputTokens: number; outputTokens: number };

export type ChatRequest = { model: string; system: string; messages: ChatMessage[] };

/**
 * A JSON Schema object describing the JSON a structured call must return.
 * Keep to what every provider's strict mode accepts: each object lists all its properties in `required`
 * and sets `additionalProperties: false`.
 */
export type JsonSchema = Record<string, unknown>;

export type StructuredRequest = ChatRequest & { schema: JsonSchema };

/** What a streamed chat turn yields: text as it's generated, then exactly one `done` with the usage. */
export type ChatEvent = { type: "text"; text: string } | { type: "done"; usage: TokenUsage };

export type StructuredResult = { data: unknown; usage: TokenUsage };

export interface LlmProvider {
  /** A streamed chat turn. */
  chat(request: ChatRequest): AsyncIterable<ChatEvent>;
  /** A single call whose reply is JSON matching `request.schema`. */
  structured(request: StructuredRequest): Promise<StructuredResult>;
}

export type { LlmErrorKind };

/**
 * Thrown by adapters. Its message never contains the API key.
 * `usage` is set when the provider billed the call before it failed (a refusal, a cut-off or unparseable reply).
 */
export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly usage?: TokenUsage,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
