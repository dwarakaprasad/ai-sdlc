import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LearningPath, PathState } from "../src/shared/api";
import { inFolder, writeFixture } from "./support/curriculumFixture";
import { readSse } from "./support/sse";
import { createTestApp } from "./support/testApp";

const term1 = `# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Understanding ratios

- Write a ratio to describe two quantities.

### Lesson 2: Equivalent ratios

- Find equivalent ratios using a table.

### Lesson 3: Rates

- Find a unit rate.

### Lesson 4: Ratio tables

- Complete a ratio table.

## Unit 2: Fractions

### Lesson 1: Dividing fractions

- Divide a fraction by a fraction.
`;

/** A Curriculum whose Math Term 1 has a four-Lesson Unit and a one-Lesson Unit, then a Term 2. */
const curriculum = {
  "curriculum.md": `# Grade 6 Sample

- District: Sample Central School District
- Grade: 6
- School year: 2026-2027
`,
  "math/term-1.md": term1,
  "math/term-2.md": `# Math: Term 2

## Unit 1: Expressions

### Lesson 1: Writing expressions

- Write an expression with a variable.
`,
};

const lesson = (unit: number, n: number, term = 1) => `math/term-${term}/unit-${unit}/lesson-${n}`;
const unit = (n: number, term = 1) => `math/term-${term}/unit-${n}`;

/** Ada's household, with the Parent and Ada both logged in and no Goals yet. */
async function household() {
  const curriculaDir = writeFixture(inFolder("grade-6", curriculum));
  const { client, llm } = createTestApp({ curriculaDir, now: () => new Date(2026, 9, 5, 12) });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const ada = (await (await parent("/api/parent/learners", { name: "Ada", grade: "6", curriculumId: "grade-6" })).json()).id as number;
  const learner = client();
  await learner("/api/learner/login", { learnerId: ada });

  const setGoal = async (lessonKey: string, beforeGoalId?: number) =>
    (await (await parent(`/api/parent/learners/${ada}/goals`, { lessonKey, targetDate: "2026-10-20", beforeGoalId })).json()).id as number;
  const goalFor = async (key: string) =>
    ((await (await parent(`/api/parent/learners/${ada}/goals`)).json()) as { id: number; lessonKey: string }[]).find((g) => g.lessonKey === key)!.id;
  const path = (subjectKey = "math") => learner(`/api/learner/subjects/${subjectKey}/path`);
  /** Each node's key and state, Unit by Unit. */
  const states = async (): Promise<[string, PathState][][]> =>
    ((await (await path()).json()) as LearningPath).units.map((u) => u.nodes.map((n): [string, PathState] => [n.key, n.state]));
  /** Hands the Goal back to the Parent: with no re-explanations allowed, one misunderstanding flags it. */
  const flag = async (goalId: number) => {
    await parent("/api/parent/settings/teaching", { maxReExplanations: 0 }, "PUT");
    const session = await (await learner(`/api/learner/goals/${goalId}/session`, {})).json();
    llm.replyWith("A ratio compares two quantities.");
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
  return { setGoal, goalFor, path, states, flag, meet, skip, curriculumFolder: join(curriculaDir, "grade-6") };
}

describe("The Learning Path", () => {
  it("shows the current Term in Curriculum order, each Lesson and Unit Test by its Goal, with an inserted Lesson current", async () => {
    const { setGoal, goalFor, path, states, meet, skip } = await household();
    // 1.1 met (which queues 1.2 next), 1.2 skipped, then 1.3 set and 1.4 inserted ahead of it.
    await meet(await setGoal(lesson(1, 1)));
    await skip(await goalFor(lesson(1, 2)));
    await setGoal(lesson(1, 4), await setGoal(lesson(1, 3)));

    const res = await path();
    expect(res.status).toBe(200);
    const learningPath: LearningPath = await res.json();
    expect(learningPath).toMatchObject({ subjectName: "Math", termName: "Term 1" });
    expect(learningPath.units.map((u) => [u.key, u.title])).toEqual([
      [unit(1), "Ratios"],
      [unit(2), "Fractions"],
    ]);
    expect(learningPath.units[0]!.nodes).toEqual([
      { key: lesson(1, 1), kind: "lesson", title: "Understanding ratios", state: "met" },
      { key: lesson(1, 2), kind: "lesson", title: "Equivalent ratios", state: "skipped" },
      { key: lesson(1, 3), kind: "lesson", title: "Rates", state: "ahead" },
      { key: lesson(1, 4), kind: "lesson", title: "Ratio tables", state: "current" },
      { key: unit(1), kind: "unit-test", title: "Ratios", state: "ahead" },
    ]);
    // Lessons with no Goal yet, and Unit Tests not yet created, are ahead.
    expect((await states())[1]).toEqual([
      [lesson(2, 1), "ahead"],
      [unit(2), "ahead"],
    ]);
  });

  it("shows a Flagged current Goal as with the Parent, so nothing on the Path is current", async () => {
    const { setGoal, states, flag } = await household();
    await flag(await setGoal(lesson(1, 1)));

    const [ratios] = await states();
    expect(ratios![0]).toEqual([lesson(1, 1), "with-parent"]);
    expect((await states()).flat().filter(([, state]) => state === "current")).toEqual([]);
  });

  it("shows nothing current while the current Goal is Orphaned, and still shows the Term", async () => {
    const { setGoal, states, meet, goalFor, curriculumFolder } = await household();
    await meet(await setGoal(lesson(1, 1)));
    await setGoal(lesson(1, 4), await goalFor(lesson(1, 2)));
    // The Parent removes Lesson 4, so the current Goal's Lesson is gone.
    writeFileSync(join(curriculumFolder, "math/term-1.md"), term1.replace(/### Lesson 4: Ratio tables[^#]*/, ""));

    expect((await states())[0]).toEqual([
      [lesson(1, 1), "met"],
      [lesson(1, 2), "ahead"],
      [lesson(1, 3), "ahead"],
      [unit(1), "ahead"],
    ]);
  });

  it("shows the Term of the last met Goal once the Subject has nothing left to meet", async () => {
    const { setGoal, goalFor, path, meet, skip } = await household();
    await meet(await setGoal(lesson(1, 1, 2)));
    await skip(await goalFor(unit(1, 2)));

    expect(await (await path()).json()).toMatchObject({
      termName: "Term 2",
      units: [{ title: "Expressions", nodes: [{ state: "met" }, { kind: "unit-test", state: "skipped" }] }],
    });
  });

  it("has no Path for a Subject with no Goals, or one not in the Curriculum", async () => {
    const { path } = await household();

    expect((await path("math")).status).toBe(404);
    expect((await path("art")).status).toBe(404);
  });
});
