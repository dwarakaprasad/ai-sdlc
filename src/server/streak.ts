import { and, eq, isNotNull } from "drizzle-orm";
import type { Streak, StreakDayState } from "../shared/api";
import type { Db, DbReader } from "./db";
import { capRefusals, goals, messages, quizAttempts, quizQuestions, sessions } from "./db/schema";
import { localDate } from "./usage";

/** Records that the daily token cap refused the Learner: the day still counts towards their Streak. */
export function recordCapRefusal(db: Db, learnerId: number, at: Date): void {
  db.insert(capRefusals).values({ learnerId, at }).run();
}

/**
 * The Learner's Streak on `now`'s day, worked out from what they did and never stored. Counting back from today: today adds
 * when it counts and, until then, doesn't break the run; each earlier day adds when it counts, a Saturday or Sunday that
 * doesn't is passed over, and the first weekday that doesn't ends the run.
 */
export function streakOf(db: DbReader, learnerId: number, now: Date): Streak {
  const worked = daysWorked(db, learnerId);
  const daysBack = (back: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

  let days = 0;
  // A weekday comes round within three days, so the run always ends.
  for (let back = 0; ; back++) {
    const day = daysBack(back);
    if (worked.has(localDate(day))) days++;
    else if (back > 0 && !isWeekend(day)) break;
  }

  const week = [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const day = daysBack(back);
    const date = localDate(day);
    const state: StreakDayState = worked.has(date) ? "worked" : back === 0 ? "today" : isWeekend(day) ? "rest" : "missed";
    return { date, state };
  });
  return { days, week };
}

/**
 * The days (by the usage's local-date rule) that count for the Learner: they sent the Tutor a message, answered a Quiz
 * question, or were refused by the daily token cap.
 */
function daysWorked(db: DbReader, learnerId: number): Set<string> {
  const sent = db
    .select({ at: messages.createdAt })
    .from(messages)
    .innerJoin(sessions, eq(messages.sessionId, sessions.id))
    .innerJoin(goals, eq(sessions.goalId, goals.id))
    .where(and(eq(goals.learnerId, learnerId), eq(messages.role, "learner")))
    .all();
  const answered = db
    .select({ at: quizQuestions.answeredAt })
    .from(quizQuestions)
    .innerJoin(quizAttempts, eq(quizQuestions.attemptId, quizAttempts.id))
    .innerJoin(sessions, eq(quizAttempts.sessionId, sessions.id))
    .innerJoin(goals, eq(sessions.goalId, goals.id))
    .where(and(eq(goals.learnerId, learnerId), isNotNull(quizQuestions.answeredAt)))
    .all();
  const refused = db.select({ at: capRefusals.at }).from(capRefusals).where(eq(capRefusals.learnerId, learnerId)).all();
  return new Set([...sent, ...answered, ...refused].flatMap(({ at }) => (at ? [localDate(at)] : [])));
}
