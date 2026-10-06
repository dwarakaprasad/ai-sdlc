import { describe, expect, it } from "vitest";
import type { Learner, LearnerToday } from "../src/shared/api";
import { household } from "./support/household";

/** One number question, as the Tutor's structured quiz generation returns it. */
const question = (n: number) => ({
  type: "number",
  prompt: `Q${n}: How many cats for every ${n} dogs if the ratio is 1:1?`,
  choices: [],
  answer: String(n),
  explanation: `The answer is ${n}.`,
  objective: n % 2 ? "Write a ratio to describe two quantities." : 'Use ratio language such as "for every".',
});

/**
 * Ada's household on a clock the test moves a day at a time (2026-10-05 is a Monday). Her Session hears the Explanation
 * the first time she works, which on its own sends the Tutor nothing.
 */
async function streakHousehold() {
  let now = new Date(2026, 9, 5, 12);
  const home = await household({ now: () => now });
  const { llm, learner, parent, turn, startLesson, ada } = home;
  let sessionId: number | undefined;

  /** Moves the clock to `hour` o'clock on `date` (YYYY-MM-DD), local time. */
  const on = (date: string, hour = 12) => {
    const [year, month, day] = date.split("-").map(Number);
    now = new Date(year!, month! - 1, day, hour);
  };
  /** Ada sends the Tutor a message in the Understanding Check, and the Tutor asks her to try again. */
  const sendMessage = async () => {
    sessionId ??= await startLesson();
    llm.decideWith({ verdict: "continue" });
    llm.replyWith("Nearly! Try again.");
    return turn(sessionId, "2 to 3");
  };
  /** Ada sends the Tutor a message on each of `dates`. */
  const workOn = async (...dates: string[]) => {
    for (const date of dates) {
      on(date);
      await sendMessage();
    }
  };
  const streak = async () => ((await (await learner("/api/learner/goals")).json()) as LearnerToday).streak;
  const parentStreak = async () => ((await (await parent("/api/parent/learners")).json()) as Learner[]).find((l) => l.id === ada)!.streak;

  /** Takes Ada through the Understanding Check and starts a ten-question Lesson Quiz; returns its question ids. */
  const startQuiz = async (): Promise<number[]> => {
    sessionId ??= await startLesson();
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Well done! A short quiz comes next.");
    await turn(sessionId, "2 to 3");
    llm.decideWith({ questions: Array.from({ length: 10 }, (_, i) => question(i + 1)) });
    const started = await (await learner(`/api/learner/sessions/${sessionId}/quiz`, {})).json();
    return started.quiz.questions.map((q: { id: number }) => q.id);
  };
  const answer = (questionId: number, given: string) => learner(`/api/learner/sessions/${sessionId}/answer`, { questionId, answer: given });

  return { ...home, on, sendMessage, workOn, streak, parentStreak, startQuiz, answer };
}

describe("The Streak", () => {
  it("is 0 before the Learner has done anything", async () => {
    const { streak } = await streakHousehold();
    expect((await streak()).days).toBe(0);
  });

  it("counts consecutive weekdays the Learner sent the Tutor a message, today included", async () => {
    const { workOn, streak } = await streakHousehold();
    await workOn("2026-10-05", "2026-10-06", "2026-10-07");
    expect((await streak()).days).toBe(3);
  });

  it("counts a day once, however many messages it had", async () => {
    const { workOn, sendMessage, streak } = await streakHousehold();
    await workOn("2026-10-05", "2026-10-06");
    await sendMessage();
    expect((await streak()).days).toBe(2);
  });

  it("isn't broken by today not being worked yet", async () => {
    const { workOn, on, streak } = await streakHousehold();
    await workOn("2026-10-05", "2026-10-06");
    on("2026-10-07", 8);
    expect((await streak()).days).toBe(2);
  });

  it("passes over a weekend with no work", async () => {
    const { workOn, on, streak } = await streakHousehold();
    await workOn("2026-10-01", "2026-10-02", "2026-10-05");
    expect((await streak()).days).toBe(3);
    // Early on Tuesday, Monday's work still carries the run over the weekend.
    on("2026-10-06", 8);
    expect((await streak()).days).toBe(3);
  });

  it("adds weekend work to the run", async () => {
    const { workOn, streak } = await streakHousehold();
    await workOn("2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05");
    expect((await streak()).days).toBe(4);
  });

  it("ends at the first weekday without work", async () => {
    const { workOn, on, streak } = await streakHousehold();
    await workOn("2026-10-01", "2026-10-05", "2026-10-06");
    expect((await streak()).days).toBe(2);
    // Nothing on Wednesday: on Thursday, the run is over.
    on("2026-10-08");
    expect((await streak()).days).toBe(0);
  });

  it("counts by the local calendar day, as usage does", async () => {
    const { on, sendMessage, streak } = await streakHousehold();
    on("2026-10-05", 23);
    await sendMessage();
    on("2026-10-06", 0);
    await sendMessage();
    expect((await streak()).days).toBe(2);
  });

  it("counts a day the Learner only answered a Quiz question", async () => {
    const { on, startQuiz, answer, streak } = await streakHousehold();
    on("2026-10-05");
    const [first] = await startQuiz();
    on("2026-10-06");
    expect((await streak()).days).toBe(1);

    expect((await answer(first!, "1")).ok).toBe(true);

    expect((await streak()).days).toBe(2);
  });

  it("counts a day the Learner's turn was refused by the daily token cap", async () => {
    const { workOn, on, sendMessage, parent, llm, streak } = await streakHousehold();
    await workOn("2026-10-05");
    on("2026-10-06");
    // The Parent's connection test uses up Tuesday's tokens before Ada arrives.
    await parent("/api/parent/settings/limits", { dailyTokenCap: 100 }, "PUT");
    llm.replyWith("OK", { inputTokens: 100, outputTokens: 0 });
    await parent("/api/parent/settings/llm/test", {});
    expect((await streak()).days).toBe(1);

    expect((await sendMessage()).status).toBe(429);

    expect((await streak()).days).toBe(2);
  });

  it("returns the last seven days, oldest first: worked, rest, missed, or today while it hasn't counted", async () => {
    const { workOn, on, sendMessage, streak } = await streakHousehold();
    await workOn("2026-09-30", "2026-10-01", "2026-10-03", "2026-10-05");
    on("2026-10-06", 8);

    expect(await streak()).toEqual({
      days: 2,
      week: [
        { date: "2026-09-30", state: "worked" },
        { date: "2026-10-01", state: "worked" },
        { date: "2026-10-02", state: "missed" },
        { date: "2026-10-03", state: "worked" },
        { date: "2026-10-04", state: "rest" },
        { date: "2026-10-05", state: "worked" },
        { date: "2026-10-06", state: "today" },
      ],
    });

    await sendMessage();
    const { days, week } = await streak();
    expect(days).toBe(3);
    expect(week[6]).toEqual({ date: "2026-10-06", state: "worked" });
  });

  it("is shown to the Parent for each Learner", async () => {
    const { workOn, parentStreak, parent } = await streakHousehold();
    await workOn("2026-10-05", "2026-10-06");
    const ben = (await (await parent("/api/parent/learners", { name: "Ben", grade: "4", curriculumId: "grade-6" })).json()) as Learner;

    expect(await parentStreak()).toBe(2);
    expect(ben.streak).toBe(0);
  });
});
