import { setTimeout as sleep } from "node:timers/promises";
import { LlmError, type ChatEvent, type ChatRequest, type LlmErrorKind, type LlmProvider, type StructuredRequest, type TokenUsage } from "../../src/llm/provider";

const DEFAULT_USAGE: TokenUsage = { inputTokens: 10, outputTokens: 5 };

type Scripted<T> = { reply: T; usage: TokenUsage; pieceDelayMs?: number } | { error: LlmErrorKind; usage?: TokenUsage };

/**
 * A scripted LLM provider: tests queue the Tutor's replies and structured decisions in order,
 * and each call takes the next one. A call with nothing queued fails the test.
 */
export function createFakeLlm() {
  const chats: Scripted<string>[] = [];
  const decisions: Scripted<unknown>[] = [];
  /** Every request the app made, in order, for tests that check what was asked. */
  const requests: ({ kind: "chat" } & ChatRequest | { kind: "structured" } & StructuredRequest)[] = [];

  const next = <T>(queue: Scripted<T>[], what: string) => {
    const item = queue.shift();
    if (!item) throw new Error(`The fake LLM was asked for a ${what} but none was scripted`);
    if ("error" in item) throw new LlmError(item.error, `scripted ${item.error}`, item.usage);
    return item;
  };

  const provider: LlmProvider = {
    async *chat(request): AsyncIterable<ChatEvent> {
      requests.push({ kind: "chat", ...request });
      const { reply, usage, pieceDelayMs } = next(chats, "chat reply");
      // Split into words so callers see the reply arrive in pieces, as from a real stream.
      for (const piece of reply.match(/\S+\s*/g) ?? []) {
        if (pieceDelayMs) await sleep(pieceDelayMs);
        yield { type: "text", text: piece };
      }
      yield { type: "done", usage };
    },
    async structured(request) {
      requests.push({ kind: "structured", ...request });
      const { reply, usage } = next(decisions, "structured decision");
      return { data: reply, usage };
    },
  };

  return {
    provider,
    requests,
    /** Queues the next streamed Tutor reply; `pieceDelayMs` spaces out its pieces, for a browser test to watch it arrive. */
    replyWith(reply: string, usage: TokenUsage = DEFAULT_USAGE, options: { pieceDelayMs?: number } = {}) {
      chats.push({ reply, usage, ...options });
    },
    /** Queues the next structured-output result. */
    decideWith(data: unknown, usage: TokenUsage = DEFAULT_USAGE) {
      decisions.push({ reply: data, usage });
    },
    /** Makes the next chat call fail the way a real adapter would; `usage` when the provider still billed it. */
    failChatWith(kind: LlmErrorKind, usage?: TokenUsage) {
      chats.push({ error: kind, usage });
    },
    /** Makes the next structured call fail the way a real adapter would; `usage` when the provider still billed it. */
    failDecisionWith(kind: LlmErrorKind, usage?: TokenUsage) {
      decisions.push({ error: kind, usage });
    },
  };
}

export type FakeLlm = ReturnType<typeof createFakeLlm>;
