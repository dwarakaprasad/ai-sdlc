import { describe, expect, it } from "vitest";
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
  return { parent, learner, ada, setGoal, setToday };
}

describe("Goals in the Parent area", () => {
  it("lists the Lessons a Goal can be set from, in Curriculum order", async () => {
    const { parent, ada } = await household();

    const res = await parent(`/api/parent/learners/${ada}/lessons`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { key: mainIdea, subjectName: "ELA", unitTitle: "Reading", title: "Main idea" },
      { key: ratios, subjectName: "Math", unitTitle: "Ratios", title: "Understanding ratios" },
      { key: equivalentRatios, subjectName: "Math", unitTitle: "Ratios", title: "Equivalent ratios" },
      { key: dividingFractions, subjectName: "Math", unitTitle: "Fractions", title: "Dividing fractions" },
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
