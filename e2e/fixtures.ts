import { test as base, expect, type APIRequestContext } from "@playwright/test";

/** The scripted fake LLM inside the e2e server, queued over its control routes (e2e/server.ts). */
export type ScriptedLlm = {
  /** Queues the next streamed Tutor reply; `pieceDelayMs` spaces out its pieces so the stream can be watched arriving. */
  replyWith(reply: string, options?: { pieceDelayMs?: number }): Promise<void>;
  /** Queues the next structured decision: an Understanding Check verdict, a generated quiz, a grade. */
  decideWith(data: unknown): Promise<void>;
};

function scriptedLlm(request: APIRequestContext): ScriptedLlm {
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { data });
    expect(res.ok(), `${path} answered ${res.status()}`).toBe(true);
  };
  return {
    replyWith: (reply, options = {}) => post("/__e2e/llm/reply", { reply, ...options }),
    decideWith: (data) => post("/__e2e/llm/decide", { data }),
  };
}

/** Each test starts on a fresh install (empty database, nothing scripted), and may take the fake LLM to script. */
export const test = base.extend<{ freshInstall: void; llm: ScriptedLlm }>({
  freshInstall: [
    async ({ request }, use) => {
      expect((await request.post("/__e2e/reset")).ok()).toBe(true);
      await use();
    },
    { auto: true },
  ],
  llm: async ({ request }, use) => use(scriptedLlm(request)),
});

export { expect };

/** A YYYY-MM-DD date `days` from today. */
export const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Sets up a household over the API, for tests whose journey starts after the Parent's part: the Parent password, then each
 * Learner on the fixture Curriculum with a Goal on its first Lesson. Logs the Parent out again, so the page opens on the profiles.
 */
export async function setUpHousehold(request: APIRequestContext, learners: { name: string; pin?: string }[]) {
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { data });
    expect(res.ok(), `${path} answered ${res.status()}`).toBe(true);
    return res;
  };
  await post("/api/parent/setup", { password: "correct horse" });
  for (const { name, pin } of learners) {
    const learner = (await (await post("/api/parent/learners", { name, grade: "6", curriculumId: "grade-6", pin })).json()) as { id: number };
    await post(`/api/parent/learners/${learner.id}/goals`, { lessonKey: "math/term-1/unit-1/lesson-1", targetDate: daysFromNow(30) });
  }
  await post("/api/parent/logout", undefined);
}
