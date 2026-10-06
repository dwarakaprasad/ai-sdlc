import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SessionMessage, TurnEvents, TutorSession } from "../shared/api";
import { START_STATE, checkTurn, tutorTurn, type TurnOutcome, type TutorLesson } from "../tutor";
import type { AppDeps } from "./deps";
import type { Db } from "./db";
import { goals, messages, sessions } from "./db/schema";
import { lessonOfGoal, type GoalRow } from "./goals";
import { readJsonObject } from "./http";
import { loggedInLearner, type LearnerRow } from "./learners";
import { appLlm } from "./llm";
import { teachingSettings } from "./settings";

type SessionRow = typeof sessions.$inferSelect;

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
      const goal = goalOf(db, learner, c.req.param("id"));
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
      const found = sessionOf(db, learner, c.req.param("id"));
      if (!found) return c.json({ error: "sessionNotFound" }, 404);
      const { session, goal } = found;
      const { message } = (await readJsonObject(c)) ?? {};
      const learnerMessage = typeof message === "string" && message.trim() !== "" ? message.trim() : undefined;
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
            .set({ ...outcome.state, endedAt: outcome.state.step === "ended" ? at : null })
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
    });
}

/** The logged-in Learner's own Goal with id `id`, if there is one. */
function goalOf(db: Db, learner: LearnerRow, id: string | undefined): GoalRow | undefined {
  if (!id || !/^\d+$/.test(id)) return undefined;
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.id, Number(id)), eq(goals.learnerId, learner.id)))
    .get();
}

/** The logged-in Learner's own Session with id `id`, with its Goal. */
function sessionOf(db: Db, learner: LearnerRow, id: string | undefined): { session: SessionRow; goal: GoalRow } | undefined {
  if (!id || !/^\d+$/.test(id)) return undefined;
  return db
    .select({ session: sessions, goal: goals })
    .from(sessions)
    .innerJoin(goals, eq(sessions.goalId, goals.id))
    .where(and(eq(sessions.id, Number(id)), eq(goals.learnerId, learner.id)))
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

function toTutorSession(db: Db, session: SessionRow, lesson: TutorLesson): TutorSession {
  return {
    id: session.id,
    subjectName: lesson.subjectName,
    title: lesson.title,
    step: session.step,
    messages: transcriptOf(db, session.id),
  };
}

