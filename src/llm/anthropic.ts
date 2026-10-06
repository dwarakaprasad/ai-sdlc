import Anthropic from "@anthropic-ai/sdk";
import { providerInfo } from "../shared/llm";
import { LlmError, type ChatEvent, type ChatRequest, type LlmProvider, type StructuredRequest, type TokenUsage } from "./provider";

const ENV_VAR = providerInfo("anthropic").envVar;
// Tutor replies and quiz decisions are short; this only guards against a runaway reply.
const MAX_TOKENS = 16000;

/**
 * The Anthropic adapter. Its key comes only from `ANTHROPIC_API_KEY` in `env` (ADR 0002),
 * read on every call so the Parent can fix it without touching settings; it is never stored or logged.
 */
export function anthropicProvider(env: Record<string, string | undefined> = process.env): LlmProvider {
  const client = () => {
    const apiKey = env[ENV_VAR]?.trim();
    if (!apiKey) throw new LlmError("missingKey", `${ENV_VAR} is not set`);
    return new Anthropic({ apiKey });
  };

  return {
    async *chat(request): AsyncIterable<ChatEvent> {
      try {
        const stream = client().messages.stream({ ...params(request), max_tokens: MAX_TOKENS });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }
        const message = await stream.finalMessage();
        const usage = usageOf(message.usage);
        if (message.stop_reason === "refusal") throw new LlmError("failed", "The model declined to answer", usage);
        yield { type: "done", usage };
      } catch (error) {
        throw toLlmError(error);
      }
    },

    async structured(request) {
      try {
        const message = await client().messages.create({
          ...params(request),
          max_tokens: MAX_TOKENS,
          output_config: { format: { type: "json_schema", schema: request.schema } },
        });
        const usage = usageOf(message.usage);
        if (message.stop_reason === "refusal") throw new LlmError("failed", "The model declined to answer", usage);
        if (message.stop_reason === "max_tokens") throw new LlmError("failed", "The reply was cut off", usage);
        const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new LlmError("failed", "The reply wasn't valid JSON", usage);
        }
        return { data, usage };
      } catch (error) {
        throw toLlmError(error);
      }
    },
  };
}

function params({ model, system, messages }: ChatRequest | StructuredRequest) {
  // The API rejects an empty system prompt, so leave it out instead.
  return { model, messages, ...(system ? { system } : {}) };
}

function usageOf(usage: Anthropic.Usage): TokenUsage {
  return {
    inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new LlmError("rejectedKey", `Anthropic rejected the key in ${ENV_VAR}`);
  }
  if (error instanceof Anthropic.NotFoundError) return new LlmError("unknownModel", "Anthropic doesn't know that model");
  if (error instanceof Anthropic.APIError) return new LlmError("failed", `Anthropic API error: ${error.message}`);
  return new LlmError("failed", error instanceof Error ? error.message : String(error));
}
