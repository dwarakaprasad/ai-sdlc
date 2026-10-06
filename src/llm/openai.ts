import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { providerInfo } from "../shared/llm";
import { LlmError, type ChatEvent, type ChatRequest, type LlmProvider, type TokenUsage } from "./provider";

const ENV_VAR = providerInfo("openai").envVar;
// Tutor replies and quiz decisions are short; this only guards against a runaway reply.
const MAX_TOKENS = 16000;

/**
 * The OpenAI adapter, over Chat Completions. Its key comes only from `OPENAI_API_KEY` in `env` (ADR 0002),
 * read on every call so the Parent can fix it without touching settings; it is never stored or logged.
 */
export function openaiProvider(env: Record<string, string | undefined> = process.env): LlmProvider {
  const client = () => {
    const apiKey = env[ENV_VAR]?.trim();
    if (!apiKey) throw new LlmError("missingKey", `${ENV_VAR} is not set`);
    return new OpenAI({ apiKey });
  };

  return {
    async *chat(request): AsyncIterable<ChatEvent> {
      try {
        const stream = await client().chat.completions.create({
          ...params(request),
          stream: true,
          stream_options: { include_usage: true },
        });
        let usage: TokenUsage | undefined;
        let refused = false;
        for await (const chunk of stream) {
          // With include_usage, the last chunk has no choices and carries the usage.
          if (chunk.usage) usage = usageOf(chunk.usage);
          const choice = chunk.choices[0];
          if (choice?.delta.refusal || choice?.finish_reason === "content_filter") refused = true;
          if (choice?.delta.content) yield { type: "text", text: choice.delta.content };
        }
        if (refused) throw new LlmError("failed", "The model declined to answer", usage);
        if (!usage) throw new LlmError("failed", "OpenAI didn't report token usage");
        yield { type: "done", usage };
      } catch (error) {
        throw toLlmError(error);
      }
    },

    async structured(request) {
      try {
        const completion = await client().chat.completions.create({
          ...params(request),
          response_format: { type: "json_schema", json_schema: { name: "reply", schema: request.schema, strict: true } },
        });
        if (!completion.usage) throw new LlmError("failed", "OpenAI didn't report token usage");
        const usage = usageOf(completion.usage);
        const choice = completion.choices[0];
        if (!choice || choice.message.refusal || choice.finish_reason === "content_filter") {
          throw new LlmError("failed", "The model declined to answer", usage);
        }
        if (choice.finish_reason === "length") throw new LlmError("failed", "The reply was cut off", usage);
        let data: unknown;
        try {
          data = JSON.parse(choice.message.content ?? "");
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

function params({ model, system, messages }: ChatRequest) {
  // Like Anthropic's adapter, leave out an empty system prompt rather than send a blank instruction.
  const all: ChatCompletionMessageParam[] = [...(system ? [{ role: "developer" as const, content: system }] : []), ...messages];
  return { model, messages: all, max_completion_tokens: MAX_TOKENS };
}

function usageOf(usage: OpenAI.CompletionUsage): TokenUsage {
  // Cached and reasoning tokens are already counted in these totals.
  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new LlmError("rejectedKey", `OpenAI rejected the key in ${ENV_VAR}`);
  }
  if (error instanceof OpenAI.NotFoundError) return new LlmError("unknownModel", "OpenAI doesn't know that model");
  if (error instanceof OpenAI.APIError) return new LlmError("failed", `OpenAI API error: ${error.message}`);
  return new LlmError("failed", error instanceof Error ? error.message : String(error));
}
