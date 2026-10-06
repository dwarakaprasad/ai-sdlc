import { test as base, expect, type APIRequestContext } from "@playwright/test";

/** The scripted fake LLM inside the e2e server, queued over its control routes (e2e/server.ts). */
export type ScriptedTutor = {
  /** Queues the next streamed Tutor reply; `pieceDelayMs` spaces out its pieces so the stream can be watched arriving. */
  replyWith(reply: string, options?: { pieceDelayMs?: number }): Promise<void>;
  /** Queues the next structured decision: an Understanding Check verdict, a generated quiz, a grade. */
  decideWith(data: unknown): Promise<void>;
};

function scriptedTutor(request: APIRequestContext): ScriptedTutor {
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { data });
    expect(res.ok(), `${path} answered ${res.status()}`).toBe(true);
  };
  return {
    replyWith: (reply, options = {}) => post("/__e2e/llm/reply", { reply, ...options }),
    decideWith: (data) => post("/__e2e/llm/decide", { data }),
  };
}

/** Each test starts on a fresh install (empty database, nothing scripted) and gets the Tutor to script. */
export const test = base.extend<{ tutor: ScriptedTutor }>({
  tutor: async ({ request }, use) => {
    expect((await request.post("/__e2e/reset")).ok()).toBe(true);
    await use(scriptedTutor(request));
  },
});

export { expect };
