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

/** Calls the app's API, failing the test unless it answers OK. */
async function call(request: APIRequestContext, method: "post" | "put", path: string, data?: unknown) {
  const res = await request[method](path, { data });
  expect(res.ok(), `${path} answered ${res.status()}`).toBe(true);
  return res;
}

/**
 * Sets up a household over the API, for tests whose journey starts after the Parent's part: the Parent password, then each
 * Learner on the fixture Curriculum with a Goal on its first Lesson, and an Avatar already picked (the fox) unless `avatar` is null.
 * Logs the Parent out again, so the page opens on the profiles.
 */
export async function setUpHousehold(request: APIRequestContext, learners: { name: string; pin?: string; avatar?: string | null }[]) {
  await call(request, "post", "/api/parent/setup", { password: "correct horse" });
  for (const { name, pin, avatar = "fox" } of learners) {
    const res = await call(request, "post", "/api/parent/learners", { name, grade: "6", curriculumId: "grade-6", pin, avatar });
    const learner = (await res.json()) as { id: number };
    await call(request, "post", `/api/parent/learners/${learner.id}/goals`, { lessonKey: "math/term-1/unit-1/lesson-1", targetDate: daysFromNow(30) });
  }
  await call(request, "post", "/api/parent/logout");
}

/**
 * Hands a Learner's current Goal back to the Parent over the API, as the Tutor would: with no re-explanations allowed, one
 * misunderstanding in the Understanding Check flags it. Leaves everyone logged out.
 */
export async function flagCurrentGoal(request: APIRequestContext, llm: ScriptedLlm, name: string) {
  await call(request, "post", "/api/parent/login", { password: "correct horse" });
  await call(request, "put", "/api/parent/settings/teaching", { maxReExplanations: 0 });
  await call(request, "post", "/api/parent/logout");
  const profiles = (await (await request.get("/api/learner/profiles")).json()) as { id: number; name: string }[];
  await call(request, "post", "/api/learner/login", { learnerId: profiles.find((p) => p.name === name)!.id });
  const today = (await (await request.get("/api/learner/goals")).json()) as { subjects: { card: { id: number } | null }[] };
  const session = (await (await call(request, "post", `/api/learner/goals/${today.subjects[0]!.card!.id}/session`, {})).json()) as { id: number };
  await llm.replyWith("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");
  await call(request, "post", `/api/learner/sessions/${session.id}/turn`, {});
  await llm.decideWith({ verdict: "re-explain" });
  await llm.replyWith("You worked hard today. Your Parent will help you with this one.");
  await call(request, "post", `/api/learner/sessions/${session.id}/turn`, { message: "I don't get it" });
  await call(request, "post", "/api/learner/logout");
}
