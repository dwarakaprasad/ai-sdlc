import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Goal, GoalCard, GoalProgress, SessionTranscript } from "../src/shared/api";
import { validCurriculum } from "./support/curriculumFixture";
import { household, ratios } from "./support/household";

const equivalentRatios = "math/term-1/unit-1/lesson-2";
const dividingFractions = "math/term-1/unit-2/lesson-1";
const WRITE_A_RATIO = "Write a ratio to describe two quantities.";
const RATIO_LANGUAGE = 'Use ratio language such as "for every".';

/** 10 number questions (the quiz length for "Understanding ratios") on its two Learning Objectives in turn; `tag` keeps each attempt's prompts apart. */
function tenQuestions(tag: string) {
  return Array.from({ length: 10 }, (_, i) => ({
    type: "number",
    prompt: `${tag}${i + 1}: What is ${i + 1} times 1?`,
    choices: [],
    answer: String(i + 1),
    explanation: `${i + 1} times 1 is ${i + 1}.`,
    objective: i % 2 === 0 ? WRITE_A_RATIO : RATIO_LANGUAGE,
  }));
}

/** Ada's household, fixed at 2026-10-05 noon, with helpers to take her through the Lesson and to see what the Parent sees. */
async function oversight() {
  const home = await household({ now: () => new Date(2026, 9, 5, 12) });
  const { parent, learner, llm, ada, turn } = home;

  /** Opens Ada's Session and talks her through to the Quiz. */
  const readyForQuiz = async (goalId = home.goalId) => {
    const session = await (await home.openSession(goalId)).json();
    llm.replyWith("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");
    await turn(session.id);
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Well done! A short quiz comes next.");
    await turn(session.id, "2 to 3");
    return session.id as number;
  };
  /** Takes one Quiz attempt, getting `wrong` of its 10 answers wrong; returns the last answer's result. */
  const takeQuiz = async (sessionId: number, tag: string, wrong = 0) => {
    llm.decideWith({ questions: tenQuestions(tag) });
    const started = await (await learner(`/api/learner/sessions/${sessionId}/quiz`, {})).json();
    let last;
    for (const [i, q] of started.quiz.questions.entries()) {
      last = await (await learner(`/api/learner/sessions/${sessionId}/answer`, { questionId: q.id, answer: i < wrong ? "999" : String(i + 1) })).json();
    }
    return last;
  };
  /** Turns one of Ada's Goals (her first, unless given) into a Flagged Goal: with no re-explanations allowed, one misunderstanding hands it back. */
  const flagGoal = async (goalId = home.goalId) => {
    await parent("/api/parent/settings/teaching", { maxReExplanations: 0 }, "PUT");
    const session = await (await home.openSession(goalId)).json();
    llm.replyWith("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");
    await turn(session.id);
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("You worked hard today. Your Parent will help you with this one.");
    await turn(session.id, "I don't get it");
    return session.id as number;
  };
  const progress = async (): Promise<GoalProgress[]> => (await parent(`/api/parent/learners/${ada}/progress`)).json();
  const goalAction = (goalId: number, action: string, body: unknown = {}) => parent(`/api/parent/learners/${ada}/goals/${goalId}/${action}`, body);
  const cards = async (): Promise<GoalCard[]> => (await learner("/api/learner/goals")).json();
  const setGoal = async (lessonKey: string, targetDate = "2026-10-20") =>
    (await (await parent(`/api/parent/learners/${ada}/goals`, { lessonKey, targetDate })).json()) as Goal;

  return { ...home, readyForQuiz, takeQuiz, flagGoal, progress, goalAction, cards, setGoal };
}

describe("The Parent's progress view", () => {
  it("shows each Goal with its Sessions and the score of every finished Quiz attempt", async () => {
    const { readyForQuiz, takeQuiz, turn, llm, progress, goalId } = await oversight();
    const sessionId = await readyForQuiz();
    await takeQuiz(sessionId, "A", 1);
    llm.replyWith("Let's look again at writing ratios.");
    await turn(sessionId);
    await takeQuiz(sessionId, "B");

    expect(await progress()).toEqual([
      expect.objectContaining({
        id: goalId,
        lessonKey: ratios,
        status: "met",
        sessions: [
          {
            id: sessionId,
            startedAt: expect.any(String),
            endedAt: expect.any(String),
            step: "goal-met",
            attempts: [
              { number: 1, correct: 9, total: 10, passed: false },
              { number: 2, correct: 10, total: 10, passed: true },
            ],
          },
        ],
      }),
      expect.objectContaining({ lessonKey: equivalentRatios, status: "active", sessions: [] }),
    ]);
  });

  it("leaves out an attempt still in progress, and shows an open Session as not ended", async () => {
    const { readyForQuiz, learner, llm, progress } = await oversight();
    const sessionId = await readyForQuiz();
    llm.decideWith({ questions: tenQuestions("A") });
    await learner(`/api/learner/sessions/${sessionId}/quiz`, {});

    const [goal] = await progress();
    expect(goal!.sessions).toEqual([{ id: sessionId, startedAt: expect.any(String), endedAt: null, step: "quiz", attempts: [] }]);
  });

  it("shows overdue and Flagged Goals", async () => {
    const { setGoal, flagGoal, progress } = await oversight();
    await setGoal(dividingFractions, "2026-10-01");
    await flagGoal();

    const goals = await progress();
    expect(goals.find((g) => g.lessonKey === ratios)).toMatchObject({ status: "flagged", overdue: false });
    expect(goals.find((g) => g.lessonKey === dividingFractions)).toMatchObject({ status: "active", overdue: true });
  });

  it("is only for the Parent", async () => {
    const { learner, ada } = await oversight();
    expect((await learner(`/api/parent/learners/${ada}/progress`)).status).toBe(403);
  });

  it("answers 404 for an unknown Learner", async () => {
    const { parent } = await oversight();
    expect((await parent("/api/parent/learners/999/progress")).status).toBe(404);
  });
});

describe("Session transcripts", () => {
  it("lets the Parent read every message of a Session, and every Quiz answer", async () => {
    const { readyForQuiz, takeQuiz, parent, ada, goalId } = await oversight();
    const sessionId = await readyForQuiz();
    await takeQuiz(sessionId, "A", 1);

    const res = await parent(`/api/parent/learners/${ada}/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const transcript: SessionTranscript = await res.json();
    expect(transcript).toMatchObject({
      id: sessionId,
      goalId,
      kind: "lesson",
      subjectName: "Math",
      title: "Understanding ratios",
      step: "re-teaching",
      endedAt: null,
      messages: [
        { role: "tutor", content: "A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?", at: expect.any(String) },
        { role: "learner", content: "2 to 3", at: expect.any(String) },
        { role: "tutor", content: "Well done! A short quiz comes next.", at: expect.any(String) },
      ],
    });
    expect(transcript.attempts).toHaveLength(1);
    expect(transcript.attempts[0]).toMatchObject({ number: 1, score: { correct: 9, total: 10, passed: false } });
    expect(transcript.attempts[0]!.questions[0]).toEqual({
      type: "number",
      prompt: "A1: What is 1 times 1?",
      choices: [],
      objective: WRITE_A_RATIO,
      answerKey: "1",
      answer: "999",
      correct: false,
      feedback: "1 times 1 is 1.",
    });
    expect(transcript.attempts[0]!.questions[1]).toMatchObject({ answer: "2", correct: true });
  });

  it("answers 404 for another Learner's Session", async () => {
    const { readyForQuiz, parent } = await oversight();
    const sessionId = await readyForQuiz();
    const ben = (await (await parent("/api/parent/learners", { name: "Ben", grade: "6", curriculumId: "grade-6" })).json()).id;

    expect((await parent(`/api/parent/learners/${ben}/sessions/${sessionId}`)).status).toBe(404);
    expect((await parent(`/api/parent/learners/${ben}/sessions/nope`)).status).toBe(404);
  });

  it("is only for the Parent", async () => {
    const { readyForQuiz, learner, ada } = await oversight();
    const sessionId = await readyForQuiz();
    expect((await learner(`/api/parent/learners/${ada}/sessions/${sessionId}`)).status).toBe(403);
  });
});

describe("Resolving a Flagged Goal", () => {
  it("retry makes it the Learner's current Goal again, starting a fresh Session from the Explanation", async () => {
    const { flagGoal, goalAction, goalId, cards, openSession } = await oversight();
    const flaggedSession = await flagGoal();
    expect(await cards()).toEqual([]);

    const res = await goalAction(goalId, "retry");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: goalId, status: "active" });
    expect(await cards()).toEqual([expect.objectContaining({ id: goalId, title: "Understanding ratios" })]);
    const session = await (await openSession()).json();
    expect(session).toMatchObject({ step: "explanation", messages: [] });
    expect(session.id).not.toBe(flaggedSession);
  });

  it("skip sets it aside, and the Learner moves on to the next Goal in the queue", async () => {
    const { flagGoal, goalAction, goalId, setGoal, cards, parent, ada } = await oversight();
    await flagGoal();
    await setGoal(equivalentRatios);

    const res = await parent(`/api/parent/learners/${ada}/goals/${goalId}/skip`, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: goalId, status: "skipped" });
    expect(await cards()).toEqual([expect.objectContaining({ title: "Equivalent ratios" })]);
    expect((await goalAction(goalId, "retry")).status).toBe(409);
  });

  it("mark met counts the Goal as met and moves the queue on to the next Lesson, as passing the Quiz would", async () => {
    const { flagGoal, goalAction, goalId, parentGoals, cards } = await oversight();
    await flagGoal();

    const res = await goalAction(goalId, "met");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: goalId, status: "met" });
    expect(await parentGoals()).toEqual([
      expect.objectContaining({ lessonKey: ratios, status: "met" }),
      expect.objectContaining({ lessonKey: equivalentRatios, status: "active", targetDate: "2026-12-01" }),
    ]);
    expect(await cards()).toEqual([expect.objectContaining({ title: "Equivalent ratios" })]);
  });

  it("mark met on a Unit's last Lesson makes the Unit Test the next Goal", async () => {
    const { flagGoal, goalAction, goalId, parentGoals } = await oversight();
    await flagGoal();
    await goalAction(goalId, "met");
    const next = (await parentGoals()).at(-1) as Goal;
    await flagGoal(next.id);

    await goalAction(next.id, "met");

    expect((await parentGoals()).map(({ kind, lessonKey, status }: Goal) => ({ kind, lessonKey, status }))).toEqual([
      { kind: "lesson", lessonKey: ratios, status: "met" },
      { kind: "lesson", lessonKey: equivalentRatios, status: "met" },
      { kind: "unit-test", lessonKey: "math/term-1/unit-1", status: "active" },
    ]);
  });

  it("refuses retry and mark met for a Goal that isn't flagged", async () => {
    const { goalAction, goalId, ada, parent } = await oversight();

    expect(await (await goalAction(goalId, "retry")).json()).toEqual({ error: "goalNotFlagged" });
    expect((await goalAction(goalId, "met")).status).toBe(409);
    expect((await parent(`/api/parent/learners/${ada}/goals/999/met`, {})).status).toBe(404);
  });
});

/** The fixture's Term 1 Math with Lesson 1 removed, so "Equivalent ratios" is renumbered to Lesson 1. */
const renumbered = `# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Equivalent ratios

- Find equivalent ratios using a table.

## Unit 2: Fractions

### Lesson 1: Dividing fractions

- Divide a fraction by a fraction.
`;

describe("Orphaned Goals", () => {
  /** Ada with a Goal for "Equivalent ratios" (Lesson 2), whose key goes when the Parent renumbers it to Lesson 1. */
  async function orphan() {
    const home = await oversight();
    const goal = await home.setGoal(equivalentRatios);
    writeFileSync(join(home.curriculumFolder, "math/term-1.md"), renumbered);
    return { ...home, orphanId: goal.id };
  }

  it("appear after a Lesson is renumbered, in the Goals list and the progress view", async () => {
    const { parentGoals, progress, orphanId, goalId } = await orphan();

    const goals: Goal[] = await parentGoals();
    expect(goals.find((g) => g.id === orphanId)).toMatchObject({ lessonKey: equivalentRatios, title: equivalentRatios, orphaned: true });
    // Lesson 1's key now names "Equivalent ratios": the key is kept, so that Goal isn't orphaned.
    expect(goals.find((g) => g.id === goalId)).toMatchObject({ orphaned: false, title: "Equivalent ratios" });
    expect((await progress()).find((g) => g.id === orphanId)).toMatchObject({ orphaned: true });
  });

  it("appear after a Lesson is removed, and hold up their Subject until the Parent resolves them", async () => {
    const home = await oversight();
    writeFileSync(join(home.curriculumFolder, "math/term-1.md"), validCurriculum["math/term-1.md"].replace(/### Lesson 1: Understanding ratios[^#]*/, ""));

    expect(await home.parentGoals()).toEqual([expect.objectContaining({ id: home.goalId, orphaned: true })]);
    expect(await home.cards()).toEqual([]);
  });

  it("are only Goals still to be met: a met Goal whose Lesson is renumbered keeps its history and can't be re-pointed", async () => {
    const { flagGoal, goalAction, goalId, parent, ada, parentGoals, curriculumFolder } = await oversight();
    await flagGoal();
    await goalAction(goalId, "met");
    // The Ratios Unit removed: both the met Goal's Lesson and the new Goal's are gone.
    writeFileSync(join(curriculumFolder, "math/term-1.md"), validCurriculum["math/term-1.md"].replace(/## Unit 1: Ratios[^]*?(?=## Unit 2)/, ""));

    const goals: Goal[] = await parentGoals();
    expect(goals.map(({ status, orphaned }) => ({ status, orphaned }))).toEqual([
      { status: "met", orphaned: false },
      { status: "active", orphaned: true },
    ]);
    expect(await (await goalAction(goalId, "repoint", { lessonKey: dividingFractions })).json()).toEqual({ error: "goalNotOrphaned" });
    expect((await parent(`/api/parent/learners/${ada}/goals/${goalId}`, undefined, "DELETE")).status).toBe(409);
  });

  it("aren't shown while the Curriculum is invalid, as every Goal would look orphaned", async () => {
    const { parentGoals, curriculumFolder } = await oversight();
    writeFileSync(join(curriculumFolder, "math/term-1.md"), "not a Curriculum");

    expect(await parentGoals()).toEqual([expect.objectContaining({ orphaned: false })]);
  });

  it("can be re-pointed to another Lesson, keeping their Target Date and Sessions", async () => {
    const { goalAction, orphanId, parentGoals, goalId, parent, ada } = await orphan();
    // Ada's other Goal already covers "Understanding ratios"' old key, so re-point to Dividing fractions.
    expect(await (await goalAction(orphanId, "repoint", { lessonKey: ratios })).json()).toEqual({ error: "lessonHasGoal" });

    const res = await goalAction(orphanId, "repoint", { lessonKey: dividingFractions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: orphanId, lessonKey: dividingFractions, title: "Dividing fractions", orphaned: false, targetDate: "2026-10-20" });
    expect((await parentGoals()).map((g: Goal) => g.id)).toEqual([goalId, orphanId]);
    expect((await goalAction(goalId, "repoint", { lessonKey: dividingFractions })).status).toBe(409);
    expect(await (await parent(`/api/parent/learners/${ada}/goals/${goalId}/repoint`, { lessonKey: "math/term-9/unit-1/lesson-1" })).json()).toEqual({
      error: "goalNotOrphaned",
    });
  });

  it("refuses to re-point to a Lesson not in the Curriculum", async () => {
    const { goalAction, orphanId } = await orphan();
    expect(await (await goalAction(orphanId, "repoint", { lessonKey: equivalentRatios })).json()).toEqual({ error: "unknownLesson" });
  });

  it("can be removed, while a Goal that isn't orphaned can't", async () => {
    const { parent, ada, orphanId, goalId, parentGoals } = await orphan();

    expect((await parent(`/api/parent/learners/${ada}/goals/${goalId}`, undefined, "DELETE")).status).toBe(409);
    expect((await parent(`/api/parent/learners/${ada}/goals/${orphanId}`, undefined, "DELETE")).status).toBe(204);
    expect((await parentGoals()).map((g: Goal) => g.id)).toEqual([goalId]);
  });
});
