import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LearnerToday } from "../src/shared/api";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { readSse } from "./support/sse";
import { createTestApp } from "./support/testApp";

/** validCurriculum (Math Term 1: two Units, three Lessons) plus a Math Term 2 and an ELA Subject. */
const curriculum = {
  ...validCurriculum,
  "math/term-2.md": `# Math: Term 2

## Unit 1: Expressions

### Lesson 1: Writing expressions

- Write an expression with a variable.
`,
  "ela/term-1.md": `# ELA: Term 1

## Unit 1: Reading

### Lesson 1: Main idea

- Find the main idea of a paragraph.
`,
};

const ratios = "math/term-1/unit-1/lesson-1";
const equivalentRatios = "math/term-1/unit-1/lesson-2";
const expressions = "math/term-2/unit-1/lesson-1";
const mainIdea = "ela/term-1/unit-1/lesson-1";

/** Math Term 1: three Lessons and two Unit Tests. */
const MATH_TERM_1 = 5;
/** ELA Term 1: one Lesson and one Unit Test. */
const ELA_TERM_1 = 2;

/** Ada's household on 2026-10-05, with the Parent and Ada both logged in and no Goals yet. */
async function household() {
  const curriculaDir = writeFixture(inFolder("grade-6", curriculum));
  const { client, llm } = createTestApp({ curriculaDir, now: () => new Date(2026, 9, 5, 12) });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const ada = (await (await parent("/api/parent/learners", { name: "Ada", grade: "6", curriculumId: "grade-6" })).json()).id as number;
  const learner = client();
  await learner("/api/learner/login", { learnerId: ada });

  const setGoal = async (lessonKey: string, targetDate: string) =>
    (await (await parent(`/api/parent/learners/${ada}/goals`, { lessonKey, targetDate })).json()).id as number;
  const today = async (): Promise<LearnerToday> => (await learner("/api/learner/goals")).json();
  /** Ada's entry for one Subject. */
  const subject = async (subjectKey: string) => (await today()).subjects.find((s) => s.subjectKey === subjectKey);
  /** Hands the Goal back to the Parent: with no re-explanations allowed, one misunderstanding flags it. */
  const flag = async (goalId: number) => {
    await parent("/api/parent/settings/teaching", { maxReExplanations: 0 }, "PUT");
    const session = await (await learner(`/api/learner/goals/${goalId}/session`, {})).json();
    llm.replyWith("A ratio compares two quantities. What is 2 cats to 3 dogs?");
    await readSse(await learner(`/api/learner/sessions/${session.id}/turn`, {}));
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Your Parent will help you with this one.");
    await readSse(await learner(`/api/learner/sessions/${session.id}/turn`, { message: "I don't get it" }));
  };
  /** Meets the Goal the way a Parent resolving a Flagged Goal does; the Subject's queue moves on as after a passed Quiz. */
  const meet = async (goalId: number) => {
    await flag(goalId);
    await parent(`/api/parent/learners/${ada}/goals/${goalId}/met`, {});
  };
  const skip = (goalId: number) => parent(`/api/parent/learners/${ada}/goals/${goalId}/skip`, {});
  const parentGoals = async (): Promise<{ id: number; lessonKey: string; status: string }[]> => (await parent(`/api/parent/learners/${ada}/goals`)).json();
  return { setGoal, today, subject, flag, meet, skip, parentGoals, curriculumFolder: join(curriculaDir, "grade-6") };
}

describe("Today, the Learner's home data", () => {
  it("has one entry per Subject with a Goal: its current Goal card and its Term's progress, earliest Target Date first", async () => {
    const { setGoal, today } = await household();
    await setGoal(ratios, "2026-10-20");
    await setGoal(mainIdea, "2026-10-12");

    expect(await today()).toEqual({
      subjects: [
        {
          subjectKey: "ela",
          subjectName: "ELA",
          card: { id: expect.any(Number), kind: "lesson", subjectName: "ELA", title: "Main idea", targetDate: "2026-10-12", overdue: false },
          withParent: false,
          term: { termName: "Term 1", met: 0, total: ELA_TERM_1 },
        },
        {
          subjectKey: "math",
          subjectName: "Math",
          card: { id: expect.any(Number), kind: "lesson", subjectName: "Math", title: "Understanding ratios", targetDate: "2026-10-20", overdue: false },
          withParent: false,
          term: { termName: "Term 1", met: 0, total: MATH_TERM_1 },
        },
      ],
      goalsMet: 0,
    });
  });

  it("leaves out a Subject with no Goals", async () => {
    const { setGoal, today } = await household();
    await setGoal(ratios, "2026-10-20");

    expect((await today()).subjects.map((s) => s.subjectKey)).toEqual(["math"]);
  });

  it("puts an overdue Goal first, so it's the one to continue", async () => {
    const { setGoal, today } = await household();
    await setGoal(mainIdea, "2026-10-12");
    await setGoal(ratios, "2026-10-01");

    const [first] = (await today()).subjects;
    expect(first).toMatchObject({ subjectKey: "math", card: { title: "Understanding ratios", overdue: true } });
  });

  it("keeps a Subject whose current Goal is Flagged, with the Parent and no card, after the Subjects with one", async () => {
    const { setGoal, today, flag } = await household();
    const ratiosGoal = await setGoal(ratios, "2026-10-01");
    await setGoal(mainIdea, "2026-10-12");

    await flag(ratiosGoal);

    expect((await today()).subjects).toMatchObject([
      { subjectKey: "ela", card: { title: "Main idea" }, withParent: false },
      { subjectKey: "math", card: null, withParent: true, term: { termName: "Term 1", met: 0, total: MATH_TERM_1 } },
    ]);
  });

  it("keeps a Subject whose current Goal is Orphaned, with the Parent and no card, after the Subjects with one", async () => {
    const { setGoal, today, curriculumFolder } = await household();
    await setGoal(equivalentRatios, "2026-10-01");
    await setGoal(mainIdea, "2026-10-12");

    // The Parent renumbers Math: "Equivalent ratios" becomes Lesson 1, so its old key is gone.
    writeFileSync(join(curriculumFolder, "math/term-1.md"), validCurriculum["math/term-1.md"].replace(/### Lesson 1: Understanding ratios[^#]*/, "").replace("Lesson 2:", "Lesson 1:"));

    expect((await today()).subjects).toMatchObject([
      { subjectKey: "ela", withParent: false },
      { subjectKey: "math", card: null, withParent: true },
    ]);
  });

  it("counts the Term's met Goals out of its Lessons and Unit Tests, and every met Goal in the total", async () => {
    const { setGoal, today, meet, skip, parentGoals } = await household();
    await meet(await setGoal(ratios, "2026-10-20"));
    // Meeting it queued the next Lesson; skipping that one doesn't count as met.
    await skip((await parentGoals()).find((g) => g.lessonKey === equivalentRatios)!.id);
    await meet(await setGoal(mainIdea, "2026-10-12"));

    const { subjects, goalsMet } = await today();
    expect(subjects.find((s) => s.subjectKey === "math")?.term).toEqual({ termName: "Term 1", met: 1, total: MATH_TERM_1 });
    // ELA's Unit Test followed its only Lesson.
    expect(subjects.find((s) => s.subjectKey === "ela")).toMatchObject({ card: { kind: "unit-test", title: "Reading" }, term: { met: 1, total: ELA_TERM_1 } });
    expect(goalsMet).toBe(2);
  });

  it("counts a Lesson met twice once in its Term's progress, and both Goals in the total", async () => {
    const { setGoal, subject, today, meet } = await household();
    await meet(await setGoal(ratios, "2026-10-20"));
    // The Parent sets the same Lesson again, and Ada meets it again.
    await meet(await setGoal(ratios, "2026-10-25"));

    expect((await subject("math"))?.term).toEqual({ termName: "Term 1", met: 1, total: MATH_TERM_1 });
    expect((await today()).goalsMet).toBe(2);
  });

  it("shows the Term of the last met Goal once a Subject has nothing left to meet", async () => {
    const { setGoal, subject, meet, skip, parentGoals } = await household();
    await meet(await setGoal(expressions, "2026-10-20"));
    // The Unit Test queued after it is set aside too.
    await skip((await parentGoals()).find((g) => g.status === "active")!.id);

    expect(await subject("math")).toEqual({
      subjectKey: "math",
      subjectName: "Math",
      card: null,
      withParent: false,
      term: { termName: "Term 2", met: 1, total: 2 },
    });
  });
});
