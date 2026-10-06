import { describe, expect, it } from "vitest";
import type { Goal, GoalCard } from "../src/shared/api";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { createTestApp } from "./support/testApp";

/** validCurriculum plus an ELA Subject, so Learners have Goals in two Subjects. */
const twoSubjects = {
  ...validCurriculum,
  "ela/term-1.md": `# ELA: Term 1

## Unit 1: Reading

### Lesson 1: Main idea

- Find the main idea of a paragraph.
`,
};

const ratios = "math/term-1/unit-1/lesson-1";
const equivalentRatios = "math/term-1/unit-1/lesson-2";
const dividingFractions = "math/term-1/unit-2/lesson-1";
const mainIdea = "ela/term-1/unit-1/lesson-1";

/**
 * An install with a logged-in Parent and one logged-in Learner, Ada, following "grade-6".
 * The clock starts at 2026-10-05 noon; `setToday` moves it.
 */
async function household() {
  let now = new Date(2026, 9, 5, 12);
  const { client } = createTestApp({
    curriculaDir: writeFixture(inFolder("grade-6", twoSubjects)),
    now: () => now,
  });
  const setToday = (year: number, month: number, day: number) => (now = new Date(year, month - 1, day, 12));
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const ada = (await (await parent("/api/parent/learners", { name: "Ada", grade: "6", curriculumId: "grade-6" })).json()).id as number;
  const setGoal = (lessonKey: string, targetDate: string, learnerId = ada) =>
    parent(`/api/parent/learners/${learnerId}/goals`, { lessonKey, targetDate });
  const learner = client();
  await learner("/api/learner/login", { learnerId: ada });
  /** Spreads Target Dates over the remaining Lessons of Ada's Term `termKey`, up to `termEndDate`. */
  const spread = (termKey: string, termEndDate: string) => parent(`/api/parent/learners/${ada}/goals/spread`, { termKey, termEndDate });
  const parentGoals = async (): Promise<Goal[]> => (await parent(`/api/parent/learners/${ada}/goals`)).json();
  /** Titles of Ada's Goal cards, in the order the Learner home screen shows them. */
  const cardTitles = async () => ((await (await learner("/api/learner/goals")).json()) as GoalCard[]).map((card) => card.title);
  return { parent, learner, ada, setGoal, setToday, spread, parentGoals, cardTitles };
}

describe("Goals in the Parent area", () => {
  it("lists the Lessons a Goal can be set from, in Curriculum order", async () => {
    const { parent, ada } = await household();

    const res = await parent(`/api/parent/learners/${ada}/lessons`);
    const elaTerm = { subjectKey: "ela", termKey: "ela/term-1", termName: "Term 1" };
    const mathTerm = { subjectKey: "math", termKey: "math/term-1", termName: "Term 1" };

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { key: mainIdea, subjectName: "ELA", ...elaTerm, unitTitle: "Reading", title: "Main idea" },
      { key: ratios, subjectName: "Math", ...mathTerm, unitTitle: "Ratios", title: "Understanding ratios" },
      { key: equivalentRatios, subjectName: "Math", ...mathTerm, unitTitle: "Ratios", title: "Equivalent ratios" },
      { key: dividingFractions, subjectName: "Math", ...mathTerm, unitTitle: "Fractions", title: "Dividing fractions" },
    ]);
  });

  it("lets the Parent set a Goal for a Lesson in the Learner's Curriculum, with a Target Date", async () => {
    const { parent, ada, setGoal } = await household();

    const res = await setGoal(equivalentRatios, "2026-10-20");

    expect(res.status).toBe(201);
    const goal = await res.json();
    expect(goal).toEqual({
      id: expect.any(Number),
      subjectKey: "math",
      subjectName: "Math",
      lessonKey: equivalentRatios,
      kind: "lesson",
      title: "Equivalent ratios",
      targetDate: "2026-10-20",
      status: "active",
      overdue: false,
    });
    expect(await (await parent(`/api/parent/learners/${ada}/goals`)).json()).toEqual([goal]);
  });

  it.each([
    ["a Lesson that isn't in the Curriculum", { lessonKey: "math/term-1/unit-9/lesson-1", targetDate: "2026-10-20" }, "unknownLesson"],
    ["no Lesson", { targetDate: "2026-10-20" }, "unknownLesson"],
    ["no Target Date", { lessonKey: ratios }, "invalidTargetDate"],
    ["a Target Date that isn't YYYY-MM-DD", { lessonKey: ratios, targetDate: "20/10/2026" }, "invalidTargetDate"],
    ["a Target Date that isn't a real day", { lessonKey: ratios, targetDate: "2026-02-30" }, "invalidTargetDate"],
  ])("refuses a Goal with %s", async (_, body, error) => {
    const { parent, ada } = await household();

    const res = await parent(`/api/parent/learners/${ada}/goals`, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await (await parent(`/api/parent/learners/${ada}/goals`)).json()).toEqual([]);
  });

  it("refuses a second Goal for a Lesson that already has one still to be met", async () => {
    const { setGoal, parentGoals } = await household();
    await setGoal(ratios, "2026-10-20");

    const res = await setGoal(ratios, "2026-10-25");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "lessonHasGoal" });
    expect(await parentGoals()).toHaveLength(1);
  });

  it("answers Goals for an unknown Learner with not found", async () => {
    const { setGoal } = await household();

    const res = await setGoal(ratios, "2026-10-20", 999);

    expect(res.status).toBe(404);
  });
});

describe("Goal cards on the Learner home screen", () => {
  it("shows one current Goal per Subject, earliest Target Date first", async () => {
    const { learner, setGoal } = await household();
    await setGoal(ratios, "2026-10-20");
    await setGoal(equivalentRatios, "2026-10-08");
    await setGoal(mainIdea, "2026-10-12");

    const res = await learner("/api/learner/goals");

    expect(res.status).toBe(200);
    // Math's current Goal is the first in its queue, even though a later one has an earlier Target Date.
    expect(await res.json()).toEqual([
      { id: expect.any(Number), subjectName: "ELA", title: "Main idea", targetDate: "2026-10-12", overdue: false },
      { id: expect.any(Number), subjectName: "Math", title: "Understanding ratios", targetDate: "2026-10-20", overdue: false },
    ]);
  });

  it("shows no Goal cards until the Parent sets a Goal", async () => {
    const { learner } = await household();

    expect(await (await learner("/api/learner/goals")).json()).toEqual([]);
  });

  it("shows a Learner only their own Goals", async () => {
    const { parent, learner, setGoal } = await household();
    const ben = (await (await parent("/api/parent/learners", { name: "Ben", grade: "6", curriculumId: "grade-6" })).json()).id as number;
    await setGoal(dividingFractions, "2026-10-20", ben);

    expect(await (await learner("/api/learner/goals")).json()).toEqual([]);
  });
});

describe("Overdue Goals", () => {
  it("marks a Goal overdue once its Target Date has passed, and changes nothing else", async () => {
    const { parent, learner, ada, setGoal, setToday } = await household();
    await setGoal(ratios, "2026-10-10");

    setToday(2026, 10, 10);
    expect(await (await parent(`/api/parent/learners/${ada}/goals`)).json()).toMatchObject([{ status: "active", overdue: false }]);
    expect(await (await learner("/api/learner/goals")).json()).toMatchObject([{ title: "Understanding ratios", overdue: false }]);

    setToday(2026, 10, 11);
    expect(await (await parent(`/api/parent/learners/${ada}/goals`)).json()).toMatchObject([
      { lessonKey: ratios, targetDate: "2026-10-10", status: "active", overdue: true },
    ]);
    expect(await (await learner("/api/learner/goals")).json()).toMatchObject([
      { title: "Understanding ratios", targetDate: "2026-10-10", overdue: true },
    ]);
  });

  it("accepts a Target Date already past, and shows the Goal as overdue straight away", async () => {
    const { setGoal } = await household();

    const res = await setGoal(ratios, "2026-10-01");

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "active", overdue: true });
  });
});

describe("Editing a Target Date", () => {
  it("changes that Goal's Target Date and leaves the others unchanged", async () => {
    const { parent, ada, spread, parentGoals } = await household();
    await spread("math/term-1", "2026-10-15");
    const [, middle] = await parentGoals();

    const res = await parent(`/api/parent/learners/${ada}/goals/${middle!.id}`, { targetDate: "2026-10-13" }, "PATCH");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: middle!.id, targetDate: "2026-10-13" });
    expect((await parentGoals()).map((goal) => goal.targetDate)).toEqual(["2026-10-08", "2026-10-13", "2026-10-15"]);
  });

  it.each([
    ["no Target Date", {}],
    ["a Target Date that isn't a real day", { targetDate: "2026-13-01" }],
  ])("refuses %s", async (_, body) => {
    const { parent, ada, setGoal, parentGoals } = await household();
    const goal = (await (await setGoal(ratios, "2026-10-08")).json()).id as number;

    const res = await parent(`/api/parent/learners/${ada}/goals/${goal}`, body, "PATCH");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalidTargetDate" });
    expect(await parentGoals()).toMatchObject([{ targetDate: "2026-10-08" }]);
  });
});

describe("Reordering Goals", () => {
  it("puts a Subject's Goals in the Parent's order, which changes the current Goal", async () => {
    const { parent, ada, spread, parentGoals, cardTitles } = await household();
    await spread("math/term-1", "2026-10-15");
    const [first, second, third] = (await parentGoals()).map((goal) => goal.id);

    const res = await parent(`/api/parent/learners/${ada}/goals/order`, { goalIds: [third, first, second] }, "PUT");

    expect(res.status).toBe(200);
    // Target Dates stay with their Goals.
    expect(await parentGoals()).toMatchObject([
      { lessonKey: dividingFractions, targetDate: "2026-10-15" },
      { lessonKey: ratios, targetDate: "2026-10-08" },
      { lessonKey: equivalentRatios, targetDate: "2026-10-11" },
    ]);
    expect(await res.json()).toEqual(await parentGoals());
    expect(await cardTitles()).toEqual(["Dividing fractions"]);
  });

  it.each([
    ["leaves out one of the Subject's Goals", (ids: number[]) => ids.slice(0, 2)],
    ["repeats a Goal", (ids: number[]) => [ids[0]!, ids[0]!, ids[1]!]],
    ["mixes in another Subject's Goal", (ids: number[], other: number) => [...ids, other]],
    ["names a Goal that doesn't exist", (ids: number[]) => [...ids, 999]],
    ["isn't a list of Goal ids", () => "first"],
  ])("refuses an order that %s", async (_, order) => {
    const { parent, ada, setGoal, spread, parentGoals } = await household();
    await spread("math/term-1", "2026-10-15");
    const other = (await (await setGoal(mainIdea, "2026-10-20")).json()).id as number;
    const before = await parentGoals();
    const mathIds = before.filter((goal) => goal.subjectKey === "math").map((goal) => goal.id);

    const res = await parent(`/api/parent/learners/${ada}/goals/order`, { goalIds: order(mathIds, other) }, "PUT");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalidOrder" });
    expect(await parentGoals()).toEqual(before);
  });
});

describe("Inserting a Goal", () => {
  it("queues the new Goal before the one the Parent names, which can make it the current Goal", async () => {
    const { parent, ada, setGoal, parentGoals, cardTitles } = await household();
    const current = (await (await setGoal(ratios, "2026-10-08")).json()).id as number;
    await setGoal(equivalentRatios, "2026-10-12");

    const res = await parent(`/api/parent/learners/${ada}/goals`, {
      lessonKey: dividingFractions,
      targetDate: "2026-10-06",
      beforeGoalId: current,
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ lessonKey: dividingFractions, targetDate: "2026-10-06" });
    expect((await parentGoals()).map((goal) => goal.lessonKey)).toEqual([dividingFractions, ratios, equivalentRatios]);
    expect(await cardTitles()).toEqual(["Dividing fractions"]);
  });

  it("can insert in the middle of the queue", async () => {
    const { parent, ada, setGoal, parentGoals, cardTitles } = await household();
    await setGoal(ratios, "2026-10-08");
    const last = (await (await setGoal(equivalentRatios, "2026-10-12")).json()).id as number;

    await parent(`/api/parent/learners/${ada}/goals`, { lessonKey: dividingFractions, targetDate: "2026-10-10", beforeGoalId: last });

    expect((await parentGoals()).map((goal) => goal.lessonKey)).toEqual([ratios, dividingFractions, equivalentRatios]);
    expect(await cardTitles()).toEqual(["Understanding ratios"]);
  });

  it.each([
    ["a Goal in another Subject", "ela"],
    ["a Goal that doesn't exist", "missing"],
  ])("refuses to insert before %s", async (_, which) => {
    const { parent, ada, setGoal, parentGoals } = await household();
    const elaGoal = (await (await setGoal(mainIdea, "2026-10-08")).json()).id as number;
    const before = await parentGoals();

    const res = await parent(`/api/parent/learners/${ada}/goals`, {
      lessonKey: ratios,
      targetDate: "2026-10-10",
      beforeGoalId: which === "ela" ? elaGoal : 999,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalidPosition" });
    expect(await parentGoals()).toEqual(before);
  });
});

describe("Skipping a Goal", () => {
  it("moves the Learner on to the next Goal in the Subject's queue", async () => {
    const { parent, ada, setGoal, cardTitles } = await household();
    const first = (await (await setGoal(ratios, "2026-10-08")).json()).id as number;
    await setGoal(equivalentRatios, "2026-10-12");

    const res = await parent(`/api/parent/learners/${ada}/goals/${first}/skip`, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: first, status: "skipped", overdue: false });
    expect(await cardTitles()).toEqual(["Equivalent ratios"]);
  });

  it("only skips a Goal still being worked on", async () => {
    const { parent, ada, setGoal } = await household();
    const goal = (await (await setGoal(ratios, "2026-10-08")).json()).id as number;
    await parent(`/api/parent/learners/${ada}/goals/${goal}/skip`, {});

    const res = await parent(`/api/parent/learners/${ada}/goals/${goal}/skip`, {});

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "goalNotActive" });
  });

  it("answers an unknown Goal, or another Learner's, with not found", async () => {
    const { parent, ada, setGoal } = await household();
    const ben = (await (await parent("/api/parent/learners", { name: "Ben", grade: "6", curriculumId: "grade-6" })).json()).id as number;
    const bensGoal = (await (await setGoal(ratios, "2026-10-08", ben)).json()).id as number;

    expect((await parent(`/api/parent/learners/${ada}/goals/${bensGoal}/skip`, {})).status).toBe(404);
    expect((await parent(`/api/parent/learners/${ada}/goals/999/skip`, {})).status).toBe(404);
  });
});

describe("Spreading Target Dates from a Term end date", () => {
  it("creates Goals for the Term's Lessons in Curriculum order, Target Dates spread evenly up to the end date", async () => {
    const { spread, parentGoals } = await household();

    // 10 days from 2026-10-05 across 3 Lessons doesn't divide evenly; every date still lands on or before the end date.
    const res = await spread("math/term-1", "2026-10-15");

    expect(res.status).toBe(200);
    const goals = await parentGoals();
    expect(await res.json()).toEqual(goals);
    expect(goals).toMatchObject([
      { lessonKey: ratios, targetDate: "2026-10-08", status: "active" },
      { lessonKey: equivalentRatios, targetDate: "2026-10-11", status: "active" },
      { lessonKey: dividingFractions, targetDate: "2026-10-15", status: "active" },
    ]);
  });

  it("updates the Goals the Learner already has instead of adding more, and leaves other Subjects alone", async () => {
    const { setGoal, spread, parentGoals } = await household();
    await setGoal(equivalentRatios, "2026-12-01");
    await setGoal(mainIdea, "2026-12-01");

    await spread("math/term-1", "2026-10-29");

    // New Goals take their place in Curriculum order around the existing one.
    expect(await parentGoals()).toMatchObject([
      { lessonKey: mainIdea, targetDate: "2026-12-01" },
      { lessonKey: ratios, targetDate: "2026-10-13" },
      { lessonKey: equivalentRatios, targetDate: "2026-10-21" },
      { lessonKey: dividingFractions, targetDate: "2026-10-29" },
    ]);
  });

  it("spreads only over the Lessons still to be met, from today", async () => {
    const { parent, ada, spread, parentGoals, setToday } = await household();
    await spread("math/term-1", "2026-10-15");
    const [first] = await parentGoals();
    await parent(`/api/parent/learners/${ada}/goals/${first!.id}/skip`, {});

    setToday(2026, 10, 9);
    await spread("math/term-1", "2026-10-19");

    expect(await parentGoals()).toMatchObject([
      { lessonKey: ratios, targetDate: "2026-10-08", status: "skipped" },
      { lessonKey: equivalentRatios, targetDate: "2026-10-14" },
      { lessonKey: dividingFractions, targetDate: "2026-10-19" },
    ]);
  });

  it("can change the current Goal by creating one for an earlier Lesson", async () => {
    const { setGoal, spread, cardTitles } = await household();
    await setGoal(dividingFractions, "2026-12-01");

    await spread("math/term-1", "2026-10-15");

    expect(await cardTitles()).toEqual(["Understanding ratios"]);
  });

  it("puts every Goal on the end date when the Term ends today", async () => {
    const { spread, parentGoals } = await household();

    await spread("math/term-1", "2026-10-05");

    expect((await parentGoals()).map((goal) => goal.targetDate)).toEqual(["2026-10-05", "2026-10-05", "2026-10-05"]);
  });

  it.each([
    ["a Term that isn't in the Curriculum", { termKey: "math/term-9", termEndDate: "2026-12-01" }, "unknownTerm"],
    ["no Term", { termEndDate: "2026-12-01" }, "unknownTerm"],
    ["no end date", { termKey: "math/term-1" }, "invalidTermEndDate"],
    ["an end date that isn't a real day", { termKey: "math/term-1", termEndDate: "2026-11-31" }, "invalidTermEndDate"],
    ["an end date already past", { termKey: "math/term-1", termEndDate: "2026-10-04" }, "termEndDatePassed"],
  ])("refuses to spread over %s", async (_, body, error) => {
    const { parent, ada, parentGoals } = await household();

    const res = await parent(`/api/parent/learners/${ada}/goals/spread`, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await parentGoals()).toEqual([]);
  });
});
