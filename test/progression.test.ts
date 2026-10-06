import { describe, expect, it } from "vitest";
import type { Goal, GoalCard } from "../src/shared/api";
import { GUARDRAILS } from "../src/tutor";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { readSse } from "./support/sse";
import { createTestApp } from "./support/testApp";

/** validCurriculum plus a second Math Term, so progression can cross the end of a Term. */
const twoTerms = {
  ...validCurriculum,
  "math/term-2.md": `# Math: Term 2

## Unit 1: Expressions

### Lesson 1: Writing expressions

- Write an expression with a variable.
`,
};

const ratios = "math/term-1/unit-1/lesson-1";
const equivalentRatios = "math/term-1/unit-1/lesson-2";
const dividingFractions = "math/term-1/unit-2/lesson-1";
const writingExpressions = "math/term-2/unit-1/lesson-1";
const ratiosUnit = "math/term-1/unit-1";
const fractionsUnit = "math/term-1/unit-2";
const expressionsUnit = "math/term-2/unit-1";

/** Each Lesson's Learning Objectives, as the fixture writes them. */
const OBJECTIVES: Record<string, string[]> = {
  [ratios]: ["Write a ratio to describe two quantities.", 'Use ratio language such as "for every".'],
  [equivalentRatios]: ["Find equivalent ratios using a table."],
  [dividingFractions]: ["Divide a fraction by a fraction."],
  [writingExpressions]: ["Write an expression with a variable."],
};
const UNIT_OBJECTIVES: Record<string, string[]> = {
  [ratiosUnit]: [...OBJECTIVES[ratios]!, ...OBJECTIVES[equivalentRatios]!],
  [fractionsUnit]: OBJECTIVES[dividingFractions]!,
  [expressionsUnit]: OBJECTIVES[writingExpressions]!,
};

type GeneratedQuestion = { type: "number"; prompt: string; choices: string[]; answer: string; explanation: string; objective: string };

/** 20 number questions (as many as any quiz takes) going round `objectives` in turn; `tag` keeps each attempt's prompts apart. */
function questionsOn(objectives: string[], tag: string): GeneratedQuestion[] {
  return Array.from({ length: 20 }, (_, i) => ({
    type: "number",
    prompt: `${tag}${i + 1}: What is ${i + 1} times 1?`,
    choices: [],
    answer: String(i + 1),
    explanation: `${i + 1} times 1 is ${i + 1}.`,
    objective: objectives[i % objectives.length]!,
  }));
}

/** The part of a Tutor instruction after the guardrails: what the Tutor is asked to do, without the Lesson context. */
const taskOf = (system: string) => system.slice(system.indexOf(GUARDRAILS) + GUARDRAILS.length);

/**
 * An install with a logged-in Parent and one logged-in Learner, Ada, following a Curriculum with two Math Terms.
 * The clock is fixed at 2026-10-05 noon.
 */
async function household() {
  const { client, llm } = createTestApp({
    curriculaDir: writeFixture(inFolder("grade-6", twoTerms)),
    now: () => new Date(2026, 9, 5, 12),
  });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const ada = (await (await parent("/api/parent/learners", { name: "Ada", grade: "6", curriculumId: "grade-6" })).json()).id as number;
  const learner = client();
  await learner("/api/learner/login", { learnerId: ada });

  const setGoal = async (lessonKey: string, targetDate = "2026-10-20") =>
    (await (await parent(`/api/parent/learners/${ada}/goals`, { lessonKey, targetDate })).json()) as Goal;
  const parentGoals = async (): Promise<Goal[]> => (await parent(`/api/parent/learners/${ada}/goals`)).json();
  const cards = async (): Promise<GoalCard[]> => (await learner("/api/learner/goals")).json();
  /** Ada's current Math Goal card. */
  const mathCard = async () => (await cards()).find((card) => card.subjectName === "Math");

  /** Taps a Goal card, opening (or resuming) its Session. */
  const openSession = async (goalId: number) => learner(`/api/learner/goals/${goalId}/session`, {});
  /** Starts the next Quiz attempt of a Session, with the Tutor generating `questions`; answers with the started Session. */
  const startQuiz = async (sessionId: number, questions: GeneratedQuestion[]) => {
    llm.decideWith({ questions });
    return learner(`/api/learner/sessions/${sessionId}/quiz`, {});
  };
  /** Answers every question of a started attempt, wrongly where `wrong` says so; returns the last result. */
  const answerAll = async (started: { id: number; quiz: { questions: { id: number; prompt: string }[] } }, wrong = (_prompt: string) => false) => {
    let last;
    for (const q of started.quiz.questions) {
      const right = /What is (\d+) times/.exec(q.prompt)![1]!;
      last = await (await learner(`/api/learner/sessions/${started.id}/answer`, { questionId: q.id, answer: wrong(q.prompt) ? "999" : right })).json();
    }
    return last;
  };

  /** Ada works through a Lesson Goal: the Explanation, the Understanding Check, then a Lesson Quiz she gets all right. */
  const passLesson = async (goal: { id: number; lessonKey?: string }, lessonKey: string) => {
    const session = await (await openSession(goal.id)).json();
    llm.replyWith("Here's the Lesson. Ready for a question?");
    await readSse(await learner(`/api/learner/sessions/${session.id}/turn`, {}));
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Well done! A short quiz comes next.");
    await readSse(await learner(`/api/learner/sessions/${session.id}/turn`, { message: "I get it" }));
    const started = await (await startQuiz(session.id, questionsOn(OBJECTIVES[lessonKey]!, lessonKey))).json();
    return answerAll(started);
  };
  /** Ada passes a Unit Test Goal at the first attempt. */
  const passUnitTest = async (goal: { id: number }, unitKey: string) => {
    const session = await (await openSession(goal.id)).json();
    const started = await (await startQuiz(session.id, questionsOn(UNIT_OBJECTIVES[unitKey]!, unitKey))).json();
    return answerAll(started);
  };
  /** Ada's Math Goals as the Parent sees them: kind, key and status, in queue order. */
  const mathQueue = async () =>
    (await parentGoals()).filter((g) => g.subjectKey === "math").map(({ kind, lessonKey, status }) => ({ kind, lessonKey, status }));

  return { parent, learner, llm, ada, setGoal, parentGoals, cards, mathCard, openSession, startQuiz, answerAll, passLesson, passUnitTest, mathQueue };
}

describe("Moving on to the next Lesson", () => {
  it("makes the next Lesson in Curriculum order the current Goal once a Lesson Goal is met", async () => {
    const { setGoal, passLesson, mathCard, parentGoals } = await household();
    const goal = await setGoal(ratios, "2026-10-20");

    const result = await passLesson(goal, ratios);

    expect(result).toMatchObject({ step: "goal-met", score: { passed: true } });
    expect(await parentGoals()).toEqual([
      expect.objectContaining({ lessonKey: ratios, status: "met" }),
      // A new Goal keeps the met Goal's Target Date, so it doesn't arrive overdue or rush ahead of the Parent's plan.
      expect.objectContaining({ lessonKey: equivalentRatios, kind: "lesson", title: "Equivalent ratios", targetDate: "2026-10-20", status: "active" }),
    ]);
    expect(await mathCard()).toEqual({
      id: expect.any(Number),
      kind: "lesson",
      subjectName: "Math",
      title: "Equivalent ratios",
      targetDate: "2026-10-20",
      overdue: false,
    });
  });

  it("gives a new Goal today's date when the met Goal's Target Date has already passed", async () => {
    const { setGoal, passLesson, parentGoals } = await household();
    const goal = await setGoal(ratios, "2026-10-01");

    await passLesson(goal, ratios);

    expect((await parentGoals()).at(-1)).toMatchObject({ lessonKey: equivalentRatios, targetDate: "2026-10-05", overdue: false });
  });

  it("follows the Goals the Parent has already queued instead of adding one", async () => {
    const { setGoal, passLesson, mathCard, mathQueue } = await household();
    const goal = await setGoal(ratios);
    // The Parent jumps ahead to Fractions, as the school did.
    await setGoal(dividingFractions, "2026-10-25");

    await passLesson(goal, ratios);

    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "lesson", lessonKey: dividingFractions, status: "active" },
    ]);
    expect(await mathCard()).toMatchObject({ title: "Dividing fractions", targetDate: "2026-10-25" });
  });

  it("passes over a Lesson whose Goal the Parent skipped", async () => {
    const { parent, ada, setGoal, passLesson, mathQueue } = await household();
    const goal = await setGoal(ratios);
    const skipped = await setGoal(equivalentRatios);
    await parent(`/api/parent/learners/${ada}/goals/${skipped.id}/skip`, {});

    await passLesson(goal, ratios);

    // Equivalent ratios wasn't met, so there is no Unit Test yet; the next Lesson without a Goal comes next.
    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "lesson", lessonKey: equivalentRatios, status: "skipped" },
      { kind: "lesson", lessonKey: dividingFractions, status: "active" },
    ]);
  });

  it("leaves the Learner's other Subjects alone", async () => {
    const { setGoal, passLesson, parentGoals } = await household();
    const goal = await setGoal(ratios);

    await passLesson(goal, ratios);

    expect((await parentGoals()).every((g) => g.subjectKey === "math")).toBe(true);
  });
});

describe("The Unit Test", () => {
  it("is created as the next Goal once every Lesson in the Unit is met", async () => {
    const { setGoal, passLesson, mathCard, mathQueue, parentGoals } = await household();
    const first = await setGoal(ratios, "2026-10-12");
    await passLesson(first, ratios);
    // The Parent has already queued the next Unit; the Unit Test still comes first.
    await setGoal(dividingFractions, "2026-10-30");
    const second = (await parentGoals()).find((g) => g.lessonKey === equivalentRatios)!;

    await passLesson(second, equivalentRatios);

    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "lesson", lessonKey: equivalentRatios, status: "met" },
      { kind: "unit-test", lessonKey: ratiosUnit, status: "active" },
      { kind: "lesson", lessonKey: dividingFractions, status: "active" },
    ]);
    expect(await mathCard()).toEqual({
      id: expect.any(Number),
      kind: "unit-test",
      subjectName: "Math",
      title: "Ratios",
      targetDate: "2026-10-12",
      overdue: false,
    });
  });

  it("is not created while a Lesson in the Unit is still to be met, which comes next instead", async () => {
    const { setGoal, passLesson, mathCard, mathQueue } = await household();
    const goal = await setGoal(equivalentRatios);

    await passLesson(goal, equivalentRatios);

    // The Parent started the Unit at its second Lesson; the first, left behind, comes before the next Unit.
    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: equivalentRatios, status: "met" },
      { kind: "lesson", lessonKey: ratios, status: "active" },
    ]);

    await passLesson((await mathCard())!, ratios);

    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: equivalentRatios, status: "met" },
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "unit-test", lessonKey: ratiosUnit, status: "active" },
    ]);
  });

  it("skips the Explanation and quizzes on every Learning Objective of the Unit", async () => {
    const { llm, setGoal, passLesson, mathCard, openSession, startQuiz } = await household();
    await passLesson(await setGoal(ratios), ratios);
    await passLesson((await mathCard())!, equivalentRatios);
    const unitTest = (await mathCard())!;

    const res = await openSession(unitTest.id);

    expect(res.status).toBe(201);
    const session = await res.json();
    expect(session).toEqual({ id: expect.any(Number), kind: "unit-test", subjectName: "Math", title: "Ratios", step: "ready-for-quiz", messages: [] });

    // Questions on only the first Lesson's Learning Objectives leave the second Lesson untested.
    expect((await startQuiz(session.id, questionsOn(OBJECTIVES[ratios]!, "X"))).status).toBe(502);
    const started = await (await startQuiz(session.id, questionsOn(UNIT_OBJECTIVES[ratiosUnit]!, "A"))).json();
    // Five questions per Learning Objective: 15 for the Unit's three.
    expect(started).toMatchObject({ step: "quiz", quiz: { number: 1, maxAttempts: 3 } });
    expect(started.quiz.questions).toHaveLength(15);
    const generation = JSON.stringify(llm.requests.at(-1));
    for (const objective of UNIT_OBJECTIVES[ratiosUnit]!) expect(generation).toContain(JSON.stringify(objective).slice(1, -1));
  });

  it("re-teaches the missed Learning Objectives after a failed attempt, and passing it continues into the next Unit", async () => {
    const { llm, learner, setGoal, passLesson, mathCard, openSession, startQuiz, answerAll, mathQueue } = await household();
    await passLesson(await setGoal(ratios), ratios);
    await passLesson((await mathCard())!, equivalentRatios);
    const session = await (await openSession((await mathCard())!.id)).json();

    // Every question on equivalent ratios (the second Lesson) wrong.
    const first = await (await startQuiz(session.id, questionsOn(UNIT_OBJECTIVES[ratiosUnit]!, "A"))).json();
    const equivalent = new Set(first.quiz.questions.filter((_: unknown, i: number) => i % 3 === 2).map((q: { prompt: string }) => q.prompt));
    const failed = await answerAll(first, (prompt) => equivalent.has(prompt));
    expect(failed).toMatchObject({ step: "re-teaching", score: { correct: 10, total: 15, passed: false } });
    expect(await mathQueue()).toContainEqual({ kind: "unit-test", lessonKey: ratiosUnit, status: "active" });

    llm.replyWith("Let's look at equivalent ratios again. Then a new Unit Test!");
    const reTeaching = await readSse(await learner(`/api/learner/sessions/${session.id}/turn`, {}));
    expect(reTeaching.done).toEqual({ step: "ready-for-quiz" });
    const task = taskOf(llm.requests.at(-1)!.system);
    expect(task).toContain("Find equivalent ratios using a table.");
    expect(task).not.toContain("Write a ratio to describe two quantities.");

    const second = await (await startQuiz(session.id, questionsOn(UNIT_OBJECTIVES[ratiosUnit]!, "B"))).json();
    expect(second.quiz.number).toBe(2);
    const passed = await answerAll(second);

    expect(passed).toMatchObject({ step: "goal-met", score: { correct: 15, total: 15, passed: true } });
    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "lesson", lessonKey: equivalentRatios, status: "met" },
      { kind: "unit-test", lessonKey: ratiosUnit, status: "met" },
      { kind: "lesson", lessonKey: dividingFractions, status: "active" },
    ]);
    expect(await mathCard()).toMatchObject({ kind: "lesson", title: "Dividing fractions" });
  });

  it("becomes a Flagged Goal after the Parent's attempt cap, like a Lesson Quiz", async () => {
    const { parent, setGoal, passLesson, mathCard, openSession, startQuiz, answerAll, mathQueue } = await household();
    await parent("/api/parent/settings/teaching", { maxQuizAttempts: 1 }, "PUT");
    await passLesson(await setGoal(dividingFractions), dividingFractions);
    const session = await (await openSession((await mathCard())!.id)).json();

    const started = await (await startQuiz(session.id, questionsOn(UNIT_OBJECTIVES[fractionsUnit]!, "A"))).json();
    const result = await answerAll(started, () => true);

    expect(result.step).toBe("ended");
    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: dividingFractions, status: "met" },
      { kind: "unit-test", lessonKey: fractionsUnit, status: "flagged" },
    ]);
    expect(await mathCard()).toBeUndefined();
  });
});

describe("The end of a Term", () => {
  it("moves on to the next Term's first Lesson once the Term's last Unit Test is met, and stops at the end of the Curriculum", async () => {
    const { setGoal, passLesson, passUnitTest, mathCard, mathQueue } = await household();
    await passLesson(await setGoal(dividingFractions), dividingFractions);
    expect(await mathCard()).toMatchObject({ kind: "unit-test", title: "Fractions" });

    await passUnitTest((await mathCard())!, fractionsUnit);
    expect(await mathCard()).toMatchObject({ kind: "lesson", title: "Writing expressions" });

    await passLesson((await mathCard())!, writingExpressions);
    await passUnitTest((await mathCard())!, expressionsUnit);

    expect(await mathQueue()).toEqual([
      { kind: "lesson", lessonKey: dividingFractions, status: "met" },
      { kind: "unit-test", lessonKey: fractionsUnit, status: "met" },
      { kind: "lesson", lessonKey: writingExpressions, status: "met" },
      { kind: "unit-test", lessonKey: expressionsUnit, status: "met" },
    ]);
    expect(await mathCard()).toBeUndefined();
  });
});
