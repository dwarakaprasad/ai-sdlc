import { describe, expect, it } from "vitest";
import { household } from "./support/household";

const EXPLANATION = "A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?";

/** Ada's household on a clock the test can move, fixed at 2026-10-05 noon to start with. */
async function limited() {
  let now = new Date(2026, 9, 5, 12);
  const home = await household({ now: () => now });
  const setLimits = (limits: unknown) => home.parent("/api/parent/settings/limits", limits, "PUT");
  return {
    ...home,
    setLimits,
    setNow: (at: Date) => {
      now = at;
    },
  };
}

describe("Limit settings", () => {
  it("have no daily token cap and a 25-minute break prompt until the Parent changes them", async () => {
    const { parent } = await limited();
    expect(await (await parent("/api/parent/settings/limits")).json()).toEqual({ dailyTokenCap: null, breakMinutes: 25 });
  });

  it("saves only the settings sent, and turns the cap off again with null", async () => {
    const { parent, setLimits } = await limited();

    expect(await (await setLimits({ dailyTokenCap: 5000 })).json()).toEqual({ dailyTokenCap: 5000, breakMinutes: 25 });
    expect(await (await setLimits({ breakMinutes: 10 })).json()).toEqual({ dailyTokenCap: 5000, breakMinutes: 10 });
    expect(await (await setLimits({ dailyTokenCap: null })).json()).toEqual({ dailyTokenCap: null, breakMinutes: 10 });
    expect(await (await parent("/api/parent/settings/limits")).json()).toEqual({ dailyTokenCap: null, breakMinutes: 10 });
  });

  it("rejects a cap or break time that isn't a positive whole number, saving nothing", async () => {
    const { parent, setLimits } = await limited();

    for (const dailyTokenCap of [0, -5, 1.5, "1000"]) {
      const res = await setLimits({ dailyTokenCap, breakMinutes: 10 });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalidDailyTokenCap" });
    }
    for (const breakMinutes of [0, 241, null]) {
      expect(await (await setLimits({ breakMinutes })).json()).toEqual({ error: "invalidBreakMinutes" });
    }
    expect(await (await parent("/api/parent/settings/limits")).json()).toEqual({ dailyTokenCap: null, breakMinutes: 25 });
  });

  it("are only for the Parent", async () => {
    const { learner } = await limited();
    expect((await learner("/api/parent/settings/limits")).status).toBe(403);
  });
});

describe("The daily token cap", () => {
  it("stops Tutor turns with a friendly message once the day's usage reaches it, without calling the LLM", async () => {
    const { setLimits, openSession, turn, llm } = await limited();
    await setLimits({ dailyTokenCap: 100 });
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION, { inputTokens: 80, outputTokens: 20 });
    expect((await turn(session.id)).done).toEqual({ step: "understanding-check" });
    const calls = llm.requests.length;

    const stopped = await turn(session.id, "2 to 3");

    expect(stopped).toMatchObject({ status: 429, error: { error: "dailyLimitReached" } });
    expect(llm.requests).toHaveLength(calls);
  });

  it("lets turns go on while the day's usage is under the cap", async () => {
    const { setLimits, openSession, turn, llm } = await limited();
    await setLimits({ dailyTokenCap: 100 });
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION, { inputTokens: 80, outputTokens: 19 });
    await turn(session.id);
    llm.decideWith({ verdict: "continue" });
    llm.replyWith("Nearly! Try again.");

    expect((await turn(session.id, "2 to 3")).done).toEqual({ step: "understanding-check" });
  });

  it("lets the Learner carry on the next day, and shows the Parent each day's usage", async () => {
    const { setLimits, openSession, turn, llm, setNow, parent } = await limited();
    await setLimits({ dailyTokenCap: 100 });
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION, { inputTokens: 90, outputTokens: 10 });
    await turn(session.id);
    expect((await turn(session.id, "2 to 3")).status).toBe(429);

    setNow(new Date(2026, 9, 6, 8));
    llm.decideWith({ verdict: "continue" }, { inputTokens: 5, outputTokens: 1 });
    llm.replyWith("Nearly! Try again.", { inputTokens: 7, outputTokens: 2 });

    expect((await turn(session.id, "2 to 3")).done).toEqual({ step: "understanding-check" });
    expect(await (await parent("/api/parent/usage")).json()).toEqual([
      { date: "2026-10-06", calls: 2, inputTokens: 12, outputTokens: 3 },
      { date: "2026-10-05", calls: 1, inputTokens: 90, outputTokens: 10 },
    ]);
  });

  it("stops a new Quiz attempt from being written once reached", async () => {
    const { setLimits, openSession, turn, llm, learner } = await limited();
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION, { inputTokens: 400, outputTokens: 100 });
    await turn(session.id);
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Well done! A short quiz comes next.");
    await turn(session.id, "2 to 3");
    await setLimits({ dailyTokenCap: 500 });

    const res = await learner(`/api/learner/sessions/${session.id}/quiz`, {});

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "dailyLimitReached" });
  });

  it("still checks number and multiple-choice answers once reached, but not written ones, which the LLM grades", async () => {
    const { setLimits, openSession, turn, llm, learner } = await limited();
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION);
    await turn(session.id);
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Well done! A short quiz comes next.");
    await turn(session.id, "2 to 3");
    const objectives = ["Write a ratio to describe two quantities.", 'Use ratio language such as "for every".'];
    llm.decideWith({
      questions: Array.from({ length: 10 }, (_, i) => ({
        type: i === 1 ? "short-answer" : "number",
        prompt: `Q${i + 1}: What is ${i + 1} times 1?`,
        choices: [],
        answer: String(i + 1),
        explanation: `${i + 1} times 1 is ${i + 1}.`,
        objective: objectives[i % 2],
      })),
    });
    const { quiz } = await (await learner(`/api/learner/sessions/${session.id}/quiz`, {})).json();
    await setLimits({ dailyTokenCap: 1 });
    const answer = (i: number) => learner(`/api/learner/sessions/${session.id}/answer`, { questionId: quiz.questions[i].id, answer: String(i + 1) });

    expect(await (await answer(0)).json()).toMatchObject({ feedback: { correct: true } });
    const written = await answer(1);
    expect(written.status).toBe(429);
    expect(await written.json()).toEqual({ error: "dailyLimitReached" });
  });

  it("doesn't count while it's off", async () => {
    const { openSession, turn, llm } = await limited();
    const session = await (await openSession()).json();
    llm.replyWith(EXPLANATION, { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    await turn(session.id);
    llm.decideWith({ verdict: "continue" });
    llm.replyWith("Nearly! Try again.");

    expect((await turn(session.id, "2 to 3")).done).toEqual({ step: "understanding-check" });
  });
});

describe("The break prompt", () => {
  it("comes after the Parent's number of minutes in a Session, 25 by default", async () => {
    const { openSession, setLimits } = await limited();
    expect(await (await openSession()).json()).toMatchObject({ breakMinutes: 25 });

    await setLimits({ breakMinutes: 10 });

    expect(await (await openSession()).json()).toMatchObject({ breakMinutes: 10 });
  });
});
