import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import type { GoalProgress, SessionSummary, SessionTranscript } from "../shared/api";
import type { AppDeps } from "./deps";
import type { DbReader } from "./db";
import { goals, messages, quizAttempts, quizQuestions, sessions } from "./db/schema";
import { goalsOf } from "./goals";
import { parseId } from "./http";
import { learnerFromPath } from "./learners";

type SessionRow = typeof sessions.$inferSelect;

/** The Parent's oversight of one Learner (progress and transcripts), mounted under the Parent's protected routes at /learners/:id. */
export function parentProgressRoutes(deps: AppDeps) {
  const { db } = deps;

  return new Hono()
    .get("/progress", (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const learnerGoals = goalsOf(deps, learner);
      const summaries = sessionSummaries(
        db,
        learnerGoals.map((g) => g.id),
      );
      const progress: GoalProgress[] = learnerGoals.map((goal) => ({ ...goal, sessions: summaries.get(goal.id) ?? [] }));
      return c.json(progress);
    })
    .get("/sessions/:sessionId", (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const sessionId = parseId(c.req.param("sessionId"));
      const session =
        sessionId === undefined
          ? undefined
          : db
              .select({ session: sessions })
              .from(sessions)
              .innerJoin(goals, eq(sessions.goalId, goals.id))
              .where(and(eq(sessions.id, sessionId), eq(goals.learnerId, learner.id)))
              .get()?.session;
      if (!session) return c.json({ error: "sessionNotFound" }, 404);
      // The Goal is the Learner's, so it is among their Goals; its title falls back to its key once orphaned.
      const goal = goalsOf(deps, learner).find((g) => g.id === session.goalId)!;
      const transcript: SessionTranscript = {
        ...sessionTimes(session),
        goalId: goal.id,
        kind: goal.kind,
        subjectName: goal.subjectName,
        title: goal.title,
        messages: db
          .select()
          .from(messages)
          .where(eq(messages.sessionId, session.id))
          .orderBy(asc(messages.id))
          .all()
          .map(({ role, content, createdAt }) => ({ role, content, at: createdAt.toISOString() })),
        attempts: attemptsWithQuestions(db, session.id),
      };
      return c.json(transcript);
    });
}

/** When a Session ran and where it got to. */
function sessionTimes({ id, startedAt, endedAt, step }: SessionRow): Omit<SessionSummary, "attempts"> {
  return { id, startedAt: startedAt.toISOString(), endedAt: endedAt?.toISOString() ?? null, step };
}

/** The Sessions of each of `goalIds` oldest first, by Goal, each with its finished Quiz attempts' scores. */
function sessionSummaries(db: DbReader, goalIds: number[]): Map<number, SessionSummary[]> {
  const rows = goalIds.length === 0 ? [] : db.select().from(sessions).where(inArray(sessions.goalId, goalIds)).orderBy(asc(sessions.id)).all();
  const attempts = rows.length === 0 ? [] : finishedAttempts(db, rows.map((s) => s.id));
  const byGoal = new Map<number, SessionSummary[]>();
  for (const session of rows) {
    const summary: SessionSummary = {
      ...sessionTimes(session),
      attempts: attempts
        .filter((a) => a.sessionId === session.id)
        .map(({ number, correct, total, passed }) => ({ number, correct, total, passed })),
    };
    byGoal.set(session.goalId, [...(byGoal.get(session.goalId) ?? []), summary]);
  }
  return byGoal;
}

/** The finished Quiz attempts of `sessionIds` in order, with their scores. */
function finishedAttempts(db: DbReader, sessionIds: number[]) {
  const attempts = db
    .select()
    .from(quizAttempts)
    .where(and(inArray(quizAttempts.sessionId, sessionIds), isNotNull(quizAttempts.finishedAt)))
    .orderBy(asc(quizAttempts.sessionId), asc(quizAttempts.number))
    .all();
  const totals = questionCounts(
    db,
    attempts.map((a) => a.id),
  );
  return attempts.map((a) => ({ sessionId: a.sessionId, number: a.number, correct: a.correct ?? 0, total: totals.get(a.id) ?? 0, passed: a.passed === true }));
}

/** How many questions each of `attemptIds` has. */
function questionCounts(db: DbReader, attemptIds: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  if (attemptIds.length === 0) return counts;
  for (const { attemptId } of db.select({ attemptId: quizQuestions.attemptId }).from(quizQuestions).where(inArray(quizQuestions.attemptId, attemptIds)).all()) {
    counts.set(attemptId, (counts.get(attemptId) ?? 0) + 1);
  }
  return counts;
}

/** A Session's Quiz attempts in order, each with its questions and answers, and its score once finished. */
function attemptsWithQuestions(db: DbReader, sessionId: number): SessionTranscript["attempts"] {
  return db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.sessionId, sessionId))
    .orderBy(asc(quizAttempts.number))
    .all()
    .map((attempt) => {
      const questions = db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.attemptId, attempt.id))
        .orderBy(asc(quizQuestions.position))
        .all()
        .map(({ type, prompt, choices, objective, answerKey, answer, correct, feedback }) => ({ type, prompt, choices, objective, answerKey, answer, correct, feedback }));
      return {
        number: attempt.number,
        questions,
        ...(attempt.correct !== null && { score: { correct: attempt.correct, total: questions.length, passed: attempt.passed === true } }),
      };
    });
}
