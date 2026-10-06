import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { LlmError } from "../llm/provider";
import { ENDING_STEPS, TUTOR_STARTED_STEPS, type AnswerResult, type QuizAttempt, type SessionMessage, type TurnEvents, type TutorSession } from "../shared/api";
import {
  START_STATE,
  afterAttempt,
  checkAnswer,
  checkTurn,
  generateQuiz,
  gradeAnswer,
  missedObjectives,
  tutorTurn,
  type Grade,
  type TurnOutcome,
  type TutorLesson,
} from "../tutor";
import type { AppDeps } from "./deps";
import type { Db, DbReader } from "./db";
import { goals, messages, quizAttempts, quizQuestions, sessions } from "./db/schema";
import { lessonOfGoal, type GoalRow } from "./goals";
import { parseId, readJsonObject } from "./http";
import { loggedInLearner, type LearnerRow } from "./learners";
import { appLlm } from "./llm";
import { teachingSettings } from "./settings";

type SessionRow = typeof sessions.$inferSelect;
type AttemptRow = typeof quizAttempts.$inferSelect;
type QuestionRow = typeof quizQuestions.$inferSelect;

/** The logged-in Learner's Sessions, mounted under the Learner's protected routes. */
export function learnerSessionRoutes(deps: AppDeps) {
  const { db, curriculaDir, now } = deps;

  /** The Lesson a Goal teaches, as the Tutor needs it; undefined when it can't be taught right now. */
  const tutorLesson = (learner: LearnerRow, goal: GoalRow): TutorLesson | undefined => {
    const found = lessonOfGoal(curriculaDir, learner, goal);
    if (!found) return undefined;
    const { subject, lesson } = found;
    return {
      subjectName: subject.name,
      title: lesson.title,
      learningObjectives: lesson.learningObjectives,
      tutoringInstructions: subject.tutoringInstructions,
    };
  };

  return new Hono()
    .post("/goals/:id/session", (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      const goal = goalOf(db, learner, parseId(c.req.param("id")));
      if (!goal) return c.json({ error: "goalNotFound" }, 404);
      if (goal.status !== "active") return c.json({ error: "goalNotActive" }, 409);
      const lesson = tutorLesson(learner, goal);
      if (!lesson) return c.json({ error: "lessonUnavailable" }, 409);

      // Tapping the card again resumes the open Session where it left off.
      const open = db
        .select()
        .from(sessions)
        .where(and(eq(sessions.goalId, goal.id), isNull(sessions.endedAt)))
        .get();
      if (open) return c.json(toTutorSession(db, open, lesson));
      const session = db
        .insert(sessions)
        .values({ goalId: goal.id, ...START_STATE, startedAt: now() })
        .returning()
        .get();
      return c.json(toTutorSession(db, session, lesson), 201);
    })
    .post("/sessions/:id/turn", async (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      const found = sessionOf(db, learner, parseId(c.req.param("id")));
      if (!found) return c.json({ error: "sessionNotFound" }, 404);
      const { session, goal } = found;
      // The Parent may have skipped the Goal while its Session was open.
      if (goal.status !== "active") return c.json({ error: "goalNotActive" }, 409);
      const { message } = (await readJsonObject(c)) ?? {};
      // The Tutor starts the Explanation and the re-teaching itself, so a message sent then is neither answered nor kept.
      const learnerMessage =
        typeof message === "string" && message.trim() !== "" && !TUTOR_STARTED_STEPS.includes(session.step) ? message.trim() : undefined;
      const state = { step: session.step, reExplanations: session.reExplanations };
      const check = checkTurn(state, learnerMessage);
      if (check === "messageRequired") return c.json({ error: "messageRequired" }, 400);
      if (check === "noTurnNow") return c.json({ error: "noTurnNow" }, 409);
      const lesson = tutorLesson(learner, goal);
      if (!lesson) return c.json({ error: "lessonUnavailable" }, 409);

      const turn = tutorTurn(
        {
          state,
          lesson,
          grade: learner.grade,
          transcript: transcriptOf(db, session.id),
          learnerMessage,
          maxReExplanations: teachingSettings(db).maxReExplanations,
          missedObjectives: missedObjectives(lesson, questionsOf(db, latestAttempt(db, session.id)?.id)),
        },
        appLlm(deps),
      );

      return streamSSE(c, async (stream) => {
        const send = <E extends keyof TurnEvents>(event: E, data: TurnEvents[E]) => stream.writeSSE({ event, data: JSON.stringify(data) });
        let reply = "";
        let outcome: TurnOutcome;
        try {
          for (let next = await turn.next(); ; next = await turn.next()) {
            if (next.done) {
              outcome = next.value;
              break;
            }
            reply += next.value;
            await send("text", { text: next.value });
          }
        } catch (error) {
          // Nothing from a failed turn is kept, so the Learner can simply try again.
          console.error("Tutor turn failed:", error instanceof Error ? error.message : error);
          await send("error", { error: "llmFailed" });
          return;
        }

        const at = now();
        const saved = db.transaction((tx) => {
          // Only when the Session is still where this turn started: another turn (say, from a second tab) may have moved it on.
          const { changes } = tx
            .update(sessions)
            .set({ ...outcome.state, endedAt: ENDING_STEPS.includes(outcome.state.step) ? at : null })
            .where(and(eq(sessions.id, session.id), eq(sessions.step, state.step), eq(sessions.reExplanations, state.reExplanations)))
            .run();
          if (changes === 0) return false;
          if (learnerMessage !== undefined) tx.insert(messages).values({ sessionId: session.id, role: "learner", content: learnerMessage, createdAt: at }).run();
          tx.insert(messages).values({ sessionId: session.id, role: "tutor", content: reply, createdAt: at }).run();
          if (outcome.flagged) tx.update(goals).set({ status: "flagged" }).where(eq(goals.id, goal.id)).run();
          return true;
        });
        if (saved) await send("done", { step: outcome.state.step });
        else await send("error", { error: "sessionChanged" });
      });
    })
    .post("/sessions/:id/quiz", async (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      const found = sessionOf(db, learner, parseId(c.req.param("id")));
      if (!found) return c.json({ error: "sessionNotFound" }, 404);
      const { session, goal } = found;
      // The Parent may have skipped the Goal while its Session was open.
      if (goal.status !== "active") return c.json({ error: "goalNotActive" }, 409);
      if (session.step !== "ready-for-quiz") return c.json({ error: "noQuizNow" }, 409);
      const lesson = tutorLesson(learner, goal);
      if (!lesson) return c.json({ error: "lessonUnavailable" }, 409);

      // Every attempt gets new questions: none may repeat one the Session has already asked.
      const earlier = db
        .select({ prompt: quizQuestions.prompt })
        .from(quizQuestions)
        .innerJoin(quizAttempts, eq(quizQuestions.attemptId, quizAttempts.id))
        .where(eq(quizAttempts.sessionId, session.id))
        .all()
        .map((q) => q.prompt);
      const questions = await llmCall(() => generateQuiz(appLlm(deps), lesson, learner.grade, earlier));
      if (!questions) return c.json({ error: "llmFailed" }, 502);

      const at = now();
      const started = db.transaction((tx) => {
        // Only while the Session still waits for an attempt: a second tap may have started one first.
        const { changes } = tx
          .update(sessions)
          .set({ step: "quiz" })
          .where(and(eq(sessions.id, session.id), eq(sessions.step, "ready-for-quiz")))
          .run();
        if (changes === 0) return false;
        const attempt = tx
          .insert(quizAttempts)
          .values({ sessionId: session.id, number: (latestAttempt(tx, session.id)?.number ?? 0) + 1, startedAt: at })
          .returning()
          .get();
        tx.insert(quizQuestions)
          .values(questions.map((q, i) => ({ attemptId: attempt.id, position: i + 1, ...q })))
          .run();
        return true;
      });
      if (!started) return c.json({ error: "sessionChanged" }, 409);
      return c.json(toTutorSession(db, { ...session, step: "quiz" }, lesson), 201);
    })
    .post("/sessions/:id/answer", async (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      const found = sessionOf(db, learner, parseId(c.req.param("id")));
      if (!found) return c.json({ error: "sessionNotFound" }, 404);
      const { session, goal } = found;
      // The Parent may have skipped the Goal while its Session was open.
      if (goal.status !== "active") return c.json({ error: "goalNotActive" }, 409);
      if (session.step !== "quiz") return c.json({ error: "noQuizNow" }, 409);
      const attempt = latestAttempt(db, session.id);
      const question = questionsOf(db, attempt?.id).find((q) => q.answer === null);
      if (!attempt || !question) return c.json({ error: "noQuizNow" }, 409);
      const { questionId, answer } = (await readJsonObject(c)) ?? {};
      if (typeof questionId !== "number") return c.json({ error: "questionRequired" }, 400);
      // The Learner answers the next unanswered question; any other was answered already, perhaps in another tab.
      if (questionId !== question.id) return c.json({ error: "sessionChanged" }, 409);
      if (typeof answer !== "string" || answer.trim() === "") return c.json({ error: "answerRequired" }, 400);
      const given = answer.trim();
      if (checkAnswer(question, given) === "invalidAnswer") return c.json({ error: "invalidAnswer" }, 400);
      const lesson = tutorLesson(learner, goal);
      if (!lesson) return c.json({ error: "lessonUnavailable" }, 409);

      const grade = await llmCall(() => gradeAnswer(appLlm(deps), lesson, learner.grade, question, given));
      if (!grade) return c.json({ error: "llmFailed" }, 502);

      const result = saveAnswer(db, { session, goal, attempt, question, answer: given, grade, at: now() });
      if (!result) return c.json({ error: "sessionChanged" }, 409);
      return c.json(result);
    });
}

/** Saves a graded answer and, when it was the attempt's last, the score and where it leads; undefined if it was answered already. */
function saveAnswer(
  db: Db,
  { session, goal, attempt, question, answer, grade, at }: { session: SessionRow; goal: GoalRow; attempt: AttemptRow; question: QuestionRow; answer: string; grade: Grade; at: Date },
): AnswerResult | undefined {
  const feedback = { correct: grade.correct, explanation: grade.explanation, correctAnswer: question.answerKey };
  return db.transaction((tx) => {
    const { changes } = tx
      .update(quizQuestions)
      .set({ answer, correct: grade.correct, feedback: grade.explanation, answeredAt: at })
      .where(and(eq(quizQuestions.id, question.id), isNull(quizQuestions.answer)))
      .run();
    if (changes === 0) return undefined;
    const questions = questionsOf(tx, attempt.id);
    if (questions.some((q) => q.answer === null)) return { feedback, step: "quiz" as const };

    const correct = questions.filter((q) => q.correct).length;
    const total = questions.length;
    const outcome = afterAttempt({ correct, total, attempt: attempt.number }, teachingSettings(tx));
    tx.update(quizAttempts).set({ correct, passed: outcome.passed, finishedAt: at }).where(eq(quizAttempts.id, attempt.id)).run();
    tx.update(sessions)
      .set({ step: outcome.step, endedAt: ENDING_STEPS.includes(outcome.step) ? at : null })
      .where(eq(sessions.id, session.id))
      .run();
    if (ENDING_STEPS.includes(outcome.step)) {
      tx.update(goals)
        .set({ status: outcome.passed ? "met" : "flagged" })
        .where(eq(goals.id, goal.id))
        .run();
    }
    return { feedback, step: outcome.step, score: { correct, total, passed: outcome.passed } };
  });
}

/** The Session as the Learner sees it, with its latest Quiz attempt. */
function toTutorSession(db: Db, session: SessionRow, lesson: TutorLesson): TutorSession {
  const attempt = latestAttempt(db, session.id);
  return {
    id: session.id,
    subjectName: lesson.subjectName,
    title: lesson.title,
    step: session.step,
    messages: transcriptOf(db, session.id),
    ...(attempt && { quiz: toQuizAttempt(attempt, questionsOf(db, attempt.id), teachingSettings(db).maxQuizAttempts) }),
  };
}

/** Runs an LLM call, turning its failure into undefined; nothing is kept from a failed call, so the Learner can simply try again. */
async function llmCall<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof LlmError)) throw error;
    console.error("Tutor call failed:", error.message);
    return undefined;
  }
}

/** The Session's latest Quiz attempt, if it has had one. */
function latestAttempt(db: DbReader, sessionId: number): AttemptRow | undefined {
  return db.select().from(quizAttempts).where(eq(quizAttempts.sessionId, sessionId)).orderBy(desc(quizAttempts.number)).get();
}

/** An attempt's questions in order; none without an attempt. */
function questionsOf(db: DbReader, attemptId: number | undefined): QuestionRow[] {
  if (attemptId === undefined) return [];
  return db.select().from(quizQuestions).where(eq(quizQuestions.attemptId, attemptId)).orderBy(asc(quizQuestions.position)).all();
}

/** An attempt as the Learner sees it: answer keys only alongside answers already given. */
function toQuizAttempt(attempt: AttemptRow, questions: QuestionRow[], maxAttempts: number): QuizAttempt {
  return {
    number: attempt.number,
    maxAttempts,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices,
      ...(q.answer !== null && {
        answered: { answer: q.answer, correct: q.correct === true, explanation: q.feedback ?? q.explanation, correctAnswer: q.answerKey },
      }),
    })),
    ...(attempt.correct !== null && { score: { correct: attempt.correct, total: questions.length, passed: attempt.passed === true } }),
  };
}

/** The logged-in Learner's own Goal with id `id`, if there is one. */
function goalOf(db: Db, learner: LearnerRow, id: number | undefined): GoalRow | undefined {
  if (id === undefined) return undefined;
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.learnerId, learner.id)))
    .get();
}

/** The logged-in Learner's own Session with id `id`, with its Goal. */
function sessionOf(db: Db, learner: LearnerRow, id: number | undefined): { session: SessionRow; goal: GoalRow } | undefined {
  if (id === undefined) return undefined;
  return db
    .select({ session: sessions, goal: goals })
    .from(sessions)
    .innerJoin(goals, eq(sessions.goalId, goals.id))
    .where(and(eq(sessions.id, id), eq(goals.learnerId, learner.id)))
    .get();
}

function transcriptOf(db: Db, sessionId: number): SessionMessage[] {
  return db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.id))
    .all();
}

