import { LlmError, type ChatEvent, type ChatMessage, type JsonSchema, type StructuredResult, type TokenUsage } from "../llm/provider";
import type { AppDeps } from "./deps";
import { llmSettings } from "./settings";
import { recordUsage } from "./usage";

export type LlmCall = { system: string; messages: ChatMessage[] };

/**
 * The LLM as the rest of the app uses it: the Parent's chosen provider and model, with every billed call's token usage recorded.
 * Settings are read on every call, so a change applies to the next turn.
 */
export function appLlm(deps: AppDeps) {
  const chosen = () => {
    const settings = llmSettings(deps.db);
    const record = (usage: TokenUsage) => recordUsage(deps.db, deps.now(), settings, usage);
    /** Records a failed call's usage when the provider billed it anyway, and passes the error on. */
    const recordFailure = (error: unknown): never => {
      if (error instanceof LlmError && error.usage) record(error.usage);
      throw error;
    };
    return { provider: deps.providers[settings.provider], model: settings.model, record, recordFailure };
  };

  return {
    /** A streamed chat turn. */
    async *chat(call: LlmCall): AsyncIterable<ChatEvent> {
      const { provider, model, record, recordFailure } = chosen();
      try {
        for await (const event of provider.chat({ model, ...call })) {
          if (event.type === "done") record(event.usage);
          yield event;
        }
      } catch (error) {
        recordFailure(error);
      }
    },
    /** A call whose reply is JSON matching `schema`. */
    async structured(call: LlmCall & { schema: JsonSchema }): Promise<StructuredResult> {
      const { provider, model, record, recordFailure } = chosen();
      const result = await provider.structured({ model, ...call }).catch(recordFailure);
      record(result.usage);
      return result;
    },
  };
}
