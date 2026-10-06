import { describe, expect, it } from "vitest";
import { household } from "./support/household";
import { GUARDRAILS } from "../src/tutor";

/** The Learning Objectives of "Understanding ratios", as the Curriculum fixture writes them. */
const WRITE_A_RATIO = "Write a ratio to describe two quantities.";
const RATIO_LANGUAGE = 'Use ratio language such as "for every".';

type GeneratedQuestion = {
  type: "multiple-choice" | "number" | "short-answer";
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  objective: string;
};

/** A number question whose answer is `answer`, as the Tutor's structured quiz generation returns it. */
const numberQuestion = (prompt: string, answer: string, objective = WRITE_A_RATIO): GeneratedQuestion => ({
  type: "number",
  prompt,
  choices: [],
  answer,
  explanation: `The answer is ${answer}.`,
  objective,
});

/** A multiple-choice question whose right choice is "for every". */
const choiceQuestion = (prompt: string, objective = RATIO_LANGUAGE): GeneratedQuestion => ({
  type: "multiple-choice",
  prompt,
  choices: ["for every", "plus", "minus"],
  answer: "for every",
  explanation: '"For every" says how one amount compares with another.',
  objective,
});

/**
 * A quiz of 10 questions (the length for a Lesson with two Learning Objectives): five number questions
 * on writing a ratio, then five multiple-choice questions on ratio language. `tag` keeps each attempt's prompts apart.
 */
function tenQuestions(tag = "A"): GeneratedQuestion[] {
  return [
    ...[1, 2, 3, 4, 5].map((n) => numberQuestion(`${tag}${n}: How many cats for every ${n} dogs if the ratio is 1:1?`, String(n))),
    ...[6, 7, 8, 9, 10].map((n) => choiceQuestion(`${tag}${n}: Which words describe a ratio?`)),
  ];
}

/** The part of a Tutor instruction after the guardrails: what the Tutor is asked to do this turn, without the Lesson context. */
const taskOf = (system: string) => system.slice(system.indexOf(GUARDRAILS) + GUARDRAILS.length);

/** The right answer to a generated question. */
const rightAnswer = (q: GeneratedQuestion) => q.answer;
/** A wrong (but well-formed) answer to a number or multiple-choice question. */
const wrongAnswer = (q: GeneratedQuestion) => (q.type === "number" ? "99" : "plus");

/** Ada's household, with her Session through the Understanding Check and ready for the Lesson Quiz. */
async function readyForQuiz() {
  const home = await household();
  const { llm, learner, turn, startLesson } = home;
  const sessionId = await startLesson();
  llm.decideWith({ verdict: "advance" });
  llm.replyWith("Well done! A short quiz comes next.");
  await turn(sessionId, "2 to 3");

  /** Starts the next Quiz attempt, with the Tutor generating `questions`. */
  const startQuiz = async (questions: GeneratedQuestion[] = tenQuestions()) => {
    llm.decideWith({ questions });
    return learner(`/api/learner/sessions/${sessionId}/quiz`, {});
  };
  /** Answers one question of the attempt in progress. */
  const answer = async (questionId: number, given: string) => learner(`/api/learner/sessions/${sessionId}/answer`, { questionId, answer: given });
  /** Answers every question of the attempt just started, in order, with `pick`; returns the last result. */
  const answerAll = async (started: { quiz: { questions: { id: number }[] } }, questions: GeneratedQuestion[], pick = rightAnswer) => {
    let last;
    for (const [i, q] of started.quiz.questions.entries()) last = await (await answer(q.id, pick(questions[i]!))).json();
    return last;
  };
  return { ...home, sessionId, startQuiz, answer, answerAll };
}

describe("The Lesson Quiz", () => {
  it("marks the Goal met when the first attempt is all right, grading number and multiple-choice answers without the LLM", async () => {
    const { llm, learner, openSession, startQuiz, answer, parentGoals } = await readyForQuiz();
    const questions = tenQuestions();

    const res = await startQuiz(questions);
    expect(res.status).toBe(201);
    const started = await res.json();
    expect(started).toMatchObject({ step: "quiz", quiz: { number: 1, maxAttempts: 3 } });
    expect(started.quiz.score).toBeUndefined();
    expect(started.quiz.questions).toHaveLength(10);
    expect(started.quiz.questions[0]).toEqual({
      id: expect.any(Number),
      type: "number",
      prompt: questions[0]!.prompt,
      choices: [],
    });
    expect(started.quiz.questions[5]).toMatchObject({ type: "multiple-choice", choices: ["for every", "plus", "minus"] });
    const llmCallsBeforeAnswers = llm.requests.length;

    const results = [];
    for (const [i, q] of started.quiz.questions.entries()) results.push(await (await answer(q.id, questions[i]!.answer)).json());

    expect(results[0]).toEqual({
      feedback: { correct: true, explanation: "The answer is 1.", correctAnswer: "1", objective: WRITE_A_RATIO },
      step: "quiz",
    });
    expect(results.at(-1)).toEqual({
      feedback: {
        correct: true,
        explanation: '"For every" says how one amount compares with another.',
        correctAnswer: "for every",
        objective: RATIO_LANGUAGE,
      },
      step: "goal-met",
      score: { correct: 10, total: 10, passed: true },
    });
    expect(llm.requests.length).toBe(llmCallsBeforeAnswers);
    // The next Lesson becomes the current Goal (see progression.test.ts).
    expect(await parentGoals()).toMatchObject([{ status: "met" }, { title: "Equivalent ratios", status: "active" }]);
    expect(await (await learner("/api/learner/goals")).json()).toMatchObject([{ title: "Equivalent ratios" }]);
    expect((await openSession()).status).toBe(409);
  });

  it("re-teaches only the missed Learning Objectives after a failed attempt, then passes a new attempt with new questions", async () => {
    const { llm, sessionId, turn, openSession, startQuiz, answerAll, parentGoals } = await readyForQuiz();
    const first = tenQuestions("A");
    // Every number question (writing a ratio) wrong; every multiple-choice one (ratio language) right.
    const failed = await answerAll(await (await startQuiz(first)).json(), first, (q) => (q.type === "number" ? "99" : q.answer));

    expect(failed).toMatchObject({ step: "re-teaching", score: { correct: 5, total: 10, passed: false } });
    expect(failed.feedback).toEqual({ correct: true, explanation: expect.any(String), correctAnswer: "for every", objective: RATIO_LANGUAGE });
    expect(await parentGoals()).toMatchObject([{ status: "active" }]);
    // Coming back shows the finished attempt's score, and that re-teaching is next.
    expect(await (await openSession()).json()).toMatchObject({ step: "re-teaching", quiz: { number: 1, score: { correct: 5, total: 10, passed: false } } });

    llm.replyWith("Let's look at writing ratios again: 3 cats for every 2 dogs is 3:2. Next, a new quiz!");
    // The Tutor starts the re-teaching; anything the Learner sends with it isn't kept.
    const reTeaching = await turn(sessionId, "hello?");

    expect(reTeaching.reply.join("")).toBe("Let's look at writing ratios again: 3 cats for every 2 dogs is 3:2. Next, a new quiz!");
    expect(reTeaching.done).toEqual({ step: "ready-for-quiz" });
    expect((await (await openSession()).json()).messages.map((m: { content: string }) => m.content)).not.toContain("hello?");
    const task = taskOf(llm.requests.at(-1)!.system);
    expect(task).toContain(WRITE_A_RATIO);
    expect(task).not.toContain(RATIO_LANGUAGE);

    const second = tenQuestions("B");
    const retry = await (await startQuiz(second)).json();
    expect(retry).toMatchObject({ step: "quiz", quiz: { number: 2, maxAttempts: 3 } });
    expect(retry.quiz.questions.map((q: { prompt: string }) => q.prompt)).toEqual(second.map((q) => q.prompt));
    const passed = await answerAll(retry, second);

    expect(passed).toMatchObject({ step: "goal-met", score: { correct: 10, total: 10, passed: true } });
    expect(await parentGoals()).toMatchObject([{ status: "met" }, { status: "active" }]);
  });

  it("never asks a question again in a later attempt", async () => {
    const { llm, sessionId, turn, startQuiz, answerAll } = await readyForQuiz();
    const first = tenQuestions("A");
    await answerAll(await (await startQuiz(first)).json(), first, wrongAnswer);
    llm.replyWith("Let's go over it again.");
    await turn(sessionId);

    // The Tutor repeats the first attempt's opening question among new ones.
    const retry = await (await startQuiz([first[0]!, ...tenQuestions("B")])).json();

    expect(retry.quiz.questions).toHaveLength(10);
    expect(retry.quiz.questions.map((q: { prompt: string }) => q.prompt)).not.toContain(first[0]!.prompt);
  });

  it("hands the Goal back to the Parent as a Flagged Goal after 3 failed attempts, ending the Session", async () => {
    const { llm, learner, sessionId, turn, openSession, startQuiz, answerAll, parentGoals } = await readyForQuiz();
    const results = [];
    for (const tag of ["A", "B", "C"]) {
      const questions = tenQuestions(tag);
      results.push(await answerAll(await (await startQuiz(questions)).json(), questions, wrongAnswer));
      if (tag !== "C") {
        llm.replyWith(`Re-teaching after attempt ${tag}.`);
        expect((await turn(sessionId)).done).toEqual({ step: "ready-for-quiz" });
      }
    }

    expect(results.map((r) => r.step)).toEqual(["re-teaching", "re-teaching", "ended"]);
    expect(results[2].score).toEqual({ correct: 0, total: 10, passed: false });
    expect(await parentGoals()).toMatchObject([{ status: "flagged" }]);
    expect(await (await learner("/api/learner/goals")).json()).toEqual([]);
    expect((await openSession()).status).toBe(409);
    expect((await learner(`/api/learner/sessions/${sessionId}/quiz`, {})).status).toBe(409);
  });

  it("uses the Parent's attempt cap", async () => {
    const { parent, startQuiz, answerAll, parentGoals } = await readyForQuiz();
    await parent("/api/parent/settings/teaching", { maxQuizAttempts: 1 }, "PUT");
    const questions = tenQuestions();

    const result = await answerAll(await (await startQuiz(questions)).json(), questions, wrongAnswer);

    expect(result.step).toBe("ended");
    expect(await parentGoals()).toMatchObject([{ status: "flagged" }]);
  });

  it("passes with the Parent's pass mark", async () => {
    const { parent, sessionId, llm, turn, startQuiz, answerAll, parentGoals } = await readyForQuiz();
    await parent("/api/parent/settings/teaching", { passMark: 80 }, "PUT");
    // 7 of 10 right falls short of 80%...
    const first = tenQuestions("A");
    const short = await answerAll(await (await startQuiz(first)).json(), first, (q) => (["A1:", "A2:", "A3:"].some((t) => q.prompt.startsWith(t)) ? "99" : q.answer));
    expect(short).toMatchObject({ step: "re-teaching", score: { correct: 7, total: 10, passed: false } });
    llm.replyWith("One more look at writing ratios.");
    await turn(sessionId);

    // ...and 8 of 10 reaches it.
    const second = tenQuestions("B");
    const enough = await answerAll(await (await startQuiz(second)).json(), second, (q) => (["B1:", "B2:"].some((t) => q.prompt.startsWith(t)) ? "99" : q.answer));

    expect(enough).toMatchObject({ step: "goal-met", score: { correct: 8, total: 10, passed: true } });
    expect(await parentGoals()).toMatchObject([{ status: "met" }, { status: "active" }]);
  });
});

describe("A finished attempt", () => {
  it("names each answered question's Learning Objective, so a failed attempt can show the Learner what they missed", async () => {
    const { startQuiz, answerAll, openSession } = await readyForQuiz();
    const questions = tenQuestions();
    await answerAll(await (await startQuiz(questions)).json(), questions, (q) => (q.type === "number" ? "99" : q.answer));

    const { quiz } = await (await openSession()).json();
    const missed = quiz.questions.filter((q: { answered: { correct: boolean } }) => !q.answered.correct);
    expect(new Set(missed.map((q: { answered: { objective: string } }) => q.answered.objective))).toEqual(new Set([WRITE_A_RATIO]));
    expect(quiz.questions[9].answered).toMatchObject({ correct: true, objective: RATIO_LANGUAGE });
  });
});

describe("Resuming a Quiz", () => {
  it("continues the same attempt at the next unanswered question after leaving and logging back in", async () => {
    const { client, ada, startQuiz, answer, parentGoals } = await readyForQuiz();
    const questions = tenQuestions();
    const started = await (await startQuiz(questions)).json();
    for (const [i, q] of started.quiz.questions.slice(0, 4).entries()) await answer(q.id, i === 0 ? "99" : questions[i]!.answer);

    // Leaving: a fresh browser logs in as the same Learner and taps the card again.
    const again = client();
    await again("/api/learner/login", { learnerId: ada });
    const [card] = await (await again("/api/learner/goals")).json();
    const resumed = await (await again(`/api/learner/goals/${card.id}/session`, {})).json();

    expect(resumed).toMatchObject({ id: started.id, step: "quiz", quiz: { number: 1 } });
    expect(resumed.quiz.questions.map((q: { id: number }) => q.id)).toEqual(started.quiz.questions.map((q: { id: number }) => q.id));
    expect(resumed.quiz.questions[0].answered).toEqual({
      answer: "99",
      correct: false,
      explanation: "The answer is 1.",
      correctAnswer: "1",
      objective: WRITE_A_RATIO,
    });
    expect(resumed.quiz.questions[3].answered).toMatchObject({ answer: "4", correct: true });
    expect(resumed.quiz.questions[4].answered).toBeUndefined();

    // An answer to a question already answered (say, from the old tab) is refused; the next one is taken.
    const stale = await again(`/api/learner/sessions/${started.id}/answer`, { questionId: started.quiz.questions[3].id, answer: "4" });
    expect(stale.status).toBe(409);
    let last;
    for (const [i, q] of resumed.quiz.questions.slice(4).entries()) {
      last = await (await again(`/api/learner/sessions/${started.id}/answer`, { questionId: q.id, answer: questions[i + 4]!.answer })).json();
    }
    expect(last.score).toEqual({ correct: 9, total: 10, passed: false });
    expect(await parentGoals()).toMatchObject([{ status: "active" }]);
  });
});

describe("Grading answers", () => {
  it("grades a short written answer through the LLM, with its one-line explanation", async () => {
    const { llm, startQuiz, answer } = await readyForQuiz();
    const written: GeneratedQuestion = {
      type: "short-answer",
      prompt: "In your own words, what does a ratio tell you?",
      choices: [],
      answer: "How much there is of one thing compared with another.",
      explanation: "A ratio compares two amounts.",
      objective: WRITE_A_RATIO,
    };
    const started = await (await startQuiz([written, ...tenQuestions().slice(1)])).json();
    expect(started.quiz.questions[0]).toMatchObject({ type: "short-answer", choices: [] });

    llm.decideWith({ correct: true, explanation: "Yes, a ratio compares two amounts." });
    const res = await (await answer(started.quiz.questions[0].id, "it compares two numbers")).json();

    expect(res).toEqual({
      feedback: { correct: true, explanation: "Yes, a ratio compares two amounts.", correctAnswer: written.answer, objective: WRITE_A_RATIO },
      step: "quiz",
    });
    const grading = llm.requests.at(-1)!;
    expect(grading.kind).toBe("structured");
    expect(grading.messages.at(-1)).toEqual({ role: "user", content: "it compares two numbers" });
  });

  it("keeps nothing from an answer whose grading failed, so the Learner can send it again", async () => {
    const { llm, startQuiz, answer, openSession } = await readyForQuiz();
    const written: GeneratedQuestion = { ...numberQuestion("What is a ratio?", "1"), type: "short-answer" };
    const started = await (await startQuiz([written, ...tenQuestions().slice(1)])).json();
    const questionId = started.quiz.questions[0].id;
    llm.failDecisionWith("failed");

    const failed = await answer(questionId, "a comparison");
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "llmFailed" });
    expect((await (await openSession()).json()).quiz.questions[0].answered).toBeUndefined();

    llm.decideWith({ correct: false, explanation: "A ratio compares two amounts." });
    expect((await (await answer(questionId, "a comparison")).json()).feedback.correct).toBe(false);
  });

  it("accepts a number written another way, such as a fraction for a decimal", async () => {
    const { startQuiz, answer } = await readyForQuiz();
    const questions = [numberQuestion("What is 3 out of 4 as a decimal?", "0.75"), numberQuestion("How many in 12 dozen?", "144"), ...tenQuestions().slice(2)];
    const started = await (await startQuiz(questions)).json();

    expect((await (await answer(started.quiz.questions[0].id, "3/4")).json()).feedback.correct).toBe(true);
    expect((await (await answer(started.quiz.questions[1].id, " 144.0 ")).json()).feedback.correct).toBe(true);
  });

  it("refuses an answer that isn't one of the choices, or isn't a number for a number question", async () => {
    const { startQuiz, answer } = await readyForQuiz();
    const questions = [choiceQuestion("Which words describe a ratio?"), ...tenQuestions().slice(1)];
    const started = await (await startQuiz(questions)).json();
    const [choice, number] = started.quiz.questions;

    for (const [id, given] of [[choice.id, "times"], [choice.id, "  "]] as const) {
      expect((await answer(id, given)).status).toBe(400);
    }
    expect(await (await answer(choice.id, "For Every")).json()).toMatchObject({ feedback: { correct: true } });
    expect(await (await answer(number.id, "two")).json()).toEqual({ error: "invalidAnswer" });
  });

  it("needs the question being answered", async () => {
    const { learner, sessionId, startQuiz } = await readyForQuiz();
    await startQuiz();

    const res = await learner(`/api/learner/sessions/${sessionId}/answer`, { answer: "1" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "questionRequired" });
  });
});

describe("Starting a Quiz attempt", () => {
  it("drops generated questions that don't hold together, and fails when too few are left", async () => {
    const { startQuiz, openSession } = await readyForQuiz();
    const broken = [
      { ...choiceQuestion("Pick one"), answer: "not a choice" },
      { ...numberQuestion("How many?", "lots") },
      { ...numberQuestion("Off-Lesson?", "1"), objective: "Something not in the Lesson." },
      ...tenQuestions().slice(3),
    ];

    const res = await startQuiz(broken);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "llmFailed" });
    expect(await (await openSession()).json()).toMatchObject({ step: "ready-for-quiz" });
    expect((await (await startQuiz([...broken, ...tenQuestions("B").slice(0, 3)])).json()).quiz.questions).toHaveLength(10);
  });

  it("keeps a Lesson with two Learning Objectives to 10 questions, even when the Tutor writes more", async () => {
    const { startQuiz } = await readyForQuiz();

    const started = await (await startQuiz([...tenQuestions("A"), ...tenQuestions("B").slice(0, 5)])).json();

    expect(started.quiz.questions).toHaveLength(10);
  });

  it("fails when the questions leave a Learning Objective untested", async () => {
    const { startQuiz, openSession } = await readyForQuiz();
    const onlyWriting = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => numberQuestion(`W${n}: How many cats for ${n} dogs at 1:1?`, String(n)));

    expect((await startQuiz(onlyWriting)).status).toBe(502);
    expect(await (await openSession()).json()).toMatchObject({ step: "ready-for-quiz" });
  });

  it("can't start before the Understanding Check is done", async () => {
    const { learner, startLesson } = await household();
    const sessionId = await startLesson();

    const res = await learner(`/api/learner/sessions/${sessionId}/quiz`, {});

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "noQuizNow" });
  });

  it("can't start another attempt while one is in progress", async () => {
    const { learner, sessionId, startQuiz } = await readyForQuiz();
    await startQuiz();

    expect((await learner(`/api/learner/sessions/${sessionId}/quiz`, {})).status).toBe(409);
  });
});

describe("The pass mark and attempt cap settings", () => {
  it("default to 100% and 3 attempts, and refuse values out of range", async () => {
    const { parent } = await household();

    expect(await (await parent("/api/parent/settings/teaching")).json()).toEqual({ maxReExplanations: 3, passMark: 100, maxQuizAttempts: 3 });
    for (const passMark of [0, 101, 99.5, "80"]) {
      expect(await (await parent("/api/parent/settings/teaching", { passMark }, "PUT")).json()).toEqual({ error: "invalidPassMark" });
    }
    for (const maxQuizAttempts of [0, 11, 2.5]) {
      expect(await (await parent("/api/parent/settings/teaching", { maxQuizAttempts }, "PUT")).json()).toEqual({ error: "invalidMaxQuizAttempts" });
    }
    // Nothing is saved when any setting sent is invalid.
    expect((await parent("/api/parent/settings/teaching", { passMark: 80, maxQuizAttempts: 0 }, "PUT")).status).toBe(400);
    expect(await (await parent("/api/parent/settings/teaching")).json()).toEqual({ maxReExplanations: 3, passMark: 100, maxQuizAttempts: 3 });
  });

  it("change only the settings sent", async () => {
    const { parent } = await household();

    await parent("/api/parent/settings/teaching", { maxReExplanations: 1 }, "PUT");
    const res = await parent("/api/parent/settings/teaching", { passMark: 90, maxQuizAttempts: 5 }, "PUT");

    expect(await res.json()).toEqual({ maxReExplanations: 1, passMark: 90, maxQuizAttempts: 5 });
  });
});
