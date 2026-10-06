import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { join } from "node:path";
import { loadCurriculum, type Curriculum, type Lesson, type Subject, type Term } from "../curriculum";
import type { Goal, GoalCard, GoalKind, GoalStatus, LessonOption } from "../shared/api";
import type { AppDeps } from "./deps";
import { parseId, readJsonObject } from "./http";
import { learnerFromPath, type LearnerRow } from "./learners";
import { localDate } from "./usage";
import type { Db, DbReader } from "./db";
import { goals } from "./db/schema";

export type GoalRow = typeof goals.$inferSelect;

/** What a Goal's key points at in the Curriculum: a Lesson, or a Unit for its Unit Test. */
type Target = { kind: GoalKind; subjectKey: string; subjectName: string; title: string };

/** The Learner's Curriculum, or undefined while it is invalid or missing. */
function curriculumOf(curriculaDir: string, learner: LearnerRow): Curriculum | undefined {
  const result = loadCurriculum(join(curriculaDir, learner.curriculumId));
  return result.ok ? result.curriculum : undefined;
}

/** Every Lesson in the Learner's Curriculum, in Curriculum order; none while the Curriculum is invalid or missing. */
function lessonsFor(curriculaDir: string, learner: LearnerRow): LessonOption[] {
  return (curriculumOf(curriculaDir, learner)?.subjects ?? []).flatMap((subject) =>
    subject.terms.flatMap((term) =>
      term.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({
          key: lesson.key,
          subjectName: subject.name,
          termKey: term.key,
          termName: term.name,
          unitTitle: unit.title,
          title: lesson.title,
        })),
      ),
    ),
  );
}

/** Every Lesson and Unit in the Learner's Curriculum by key; empty while the Curriculum is invalid or missing. */
function targetsFor(curriculaDir: string, learner: LearnerRow): Map<string, Target> {
  const targets = new Map<string, Target>();
  for (const subject of curriculumOf(curriculaDir, learner)?.subjects ?? []) {
    for (const unit of subject.terms.flatMap((t) => t.units)) {
      const at = { subjectKey: subject.key, subjectName: subject.name };
      targets.set(unit.key, { kind: "unit-test", ...at, title: unit.title });
      for (const lesson of unit.lessons) targets.set(lesson.key, { kind: "lesson", ...at, title: lesson.title });
    }
  }
  return targets;
}

/** The Lesson a lesson Goal points at, with its Subject; undefined for a Unit Test or while the Lesson or Curriculum is gone or invalid. */
export function lessonOfGoal(curriculaDir: string, learner: LearnerRow, goal: GoalRow): { subject: Subject; lesson: Lesson } | undefined {
  if (goal.kind !== "lesson") return undefined;
  for (const subject of curriculumOf(curriculaDir, learner)?.subjects ?? []) {
    for (const unit of subject.terms.flatMap((t) => t.units)) {
      const lesson = unit.lessons.find((l) => l.key === goal.curriculumKey);
      if (lesson) return { subject, lesson };
    }
  }
  return undefined;
}

/** Overdue: the Target Date has passed and the Goal is still to be met. Never stored, so it is always current. */
function isOverdue(row: GoalRow, today: string): boolean {
  return isToBeMet(row.status) && row.targetDate < today;
}

/** Active or Flagged: neither met nor skipped. */
function isToBeMet(status: GoalStatus): boolean {
  return status === "active" || status === "flagged";
}

/** A Learner's Goals with their Lesson or Unit titles, each Subject's queue in order. */
function goalsOf({ db, curriculaDir, now }: AppDeps, learner: LearnerRow): Goal[] {
  const targets = targetsFor(curriculaDir, learner);
  const today = localDate(now());
  return db
    .select()
    .from(goals)
    .where(eq(goals.learnerId, learner.id))
    .orderBy(goals.subjectKey, goals.position, goals.id)
    .all()
    .map((row) => toGoal(row, targets.get(row.curriculumKey), today));
}

/**
 * The Learner's Goal cards: each Subject's current Goal (the first in its queue still to be met), earliest Target Date first.
 * A Flagged Goal waits for the Parent, so its Subject shows no card until the Parent resolves it.
 */
export function currentGoals(deps: AppDeps, learner: LearnerRow): GoalCard[] {
  const current = new Map<string, Goal>();
  for (const goal of goalsOf(deps, learner)) {
    if (isToBeMet(goal.status) && !current.has(goal.subjectKey)) current.set(goal.subjectKey, goal);
  }
  return [...current.values()]
    .filter((goal) => goal.status === "active")
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.subjectName.localeCompare(b.subjectName))
    .map(({ id, subjectName, title, targetDate, overdue }) => ({ id, subjectName, title, targetDate, overdue }));
}

/** The Parent's Goals for one Learner, mounted under the Parent's protected routes at /learners/:id. */
export function parentGoalRoutes(deps: AppDeps) {
  const { db, curriculaDir, now } = deps;

  return new Hono()
    .get("/lessons", (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      return c.json(lessonsFor(curriculaDir, learner));
    })
    .get("/goals", (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      return c.json(goalsOf(deps, learner));
    })
    .post("/goals", async (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const body = await readJsonObject(c);
      if (!body) return c.json({ error: "invalidBody" }, 400);
      const { lessonKey, targetDate, beforeGoalId } = body;
      const target = typeof lessonKey === "string" ? targetsFor(curriculaDir, learner).get(lessonKey) : undefined;
      if (target?.kind !== "lesson" || typeof lessonKey !== "string") return c.json({ error: "unknownLesson" }, 400);
      if (typeof targetDate !== "string" || !isCalendarDate(targetDate)) return c.json({ error: "invalidTargetDate" }, 400);

      // A new Goal joins the end of its Subject's queue, unless the Parent inserts it before one of that Subject's Goals.
      const queue: QueueEntry[] = subjectQueue(db, learner.id, target.subjectKey);
      const at = beforeGoalId === undefined ? queue.length : queue.findIndex((goal) => "id" in goal && goal.id === beforeGoalId);
      if (at === -1) return c.json({ error: "invalidPosition" }, 400);
      queue.splice(at, 0, {
        learnerId: learner.id,
        subjectKey: target.subjectKey,
        curriculumKey: lessonKey,
        kind: "lesson",
        targetDate,
        status: "active",
      });
      const row = saveQueue(db, queue)[at]!;
      return c.json(toGoal(row, target, localDate(now())), 201);
    })
    .post("/goals/spread", async (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const body = await readJsonObject(c);
      if (!body) return c.json({ error: "invalidBody" }, 400);
      const { termKey, termEndDate } = body;
      const found = typeof termKey === "string" ? termOf(curriculaDir, learner, termKey) : undefined;
      if (!found) return c.json({ error: "unknownTerm" }, 400);
      if (typeof termEndDate !== "string" || !isCalendarDate(termEndDate)) return c.json({ error: "invalidTermEndDate" }, 400);
      const today = localDate(now());
      if (termEndDate < today) return c.json({ error: "termEndDatePassed" }, 400);
      spreadTargetDates(db, learner, found.subject, found.term, today, termEndDate);
      return c.json(goalsOf(deps, learner));
    })
    .put("/goals/order", async (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const { goalIds } = (await readJsonObject(c)) ?? {};
      const queue = reorderedQueue(db, learner, goalIds);
      if (!queue) return c.json({ error: "invalidOrder" }, 400);
      saveQueue(db, queue);
      return c.json(goalsOf(deps, learner));
    })
    .patch("/goals/:goalId", async (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      const { learner, goal } = found;
      const { targetDate } = (await readJsonObject(c)) ?? {};
      if (typeof targetDate !== "string" || !isCalendarDate(targetDate)) return c.json({ error: "invalidTargetDate" }, 400);
      const row = db.update(goals).set({ targetDate }).where(eq(goals.id, goal.id)).returning().get()!;
      return c.json(toGoal(row, targetsFor(curriculaDir, learner).get(row.curriculumKey), localDate(now())));
    })
    .post("/goals/:goalId/skip", (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      const { learner, goal } = found;
      if (goal.status !== "active") return c.json({ error: "goalNotActive" }, 409);
      const row = db.update(goals).set({ status: "skipped" }).where(eq(goals.id, goal.id)).returning().get()!;
      return c.json(toGoal(row, targetsFor(curriculaDir, learner).get(row.curriculumKey), localDate(now())));
    });
}

/** The Learner named by the `:id` path parameter and their Goal named by `:goalId`, or which of them wasn't found. */
function goalFromPath(db: Db, c: Context): { learner: LearnerRow; goal: GoalRow } | { error: "learnerNotFound" | "goalNotFound" } {
  const learner = learnerFromPath(db, c);
  if (!learner) return { error: "learnerNotFound" };
  const goalId = parseId(c.req.param("goalId"));
  const goal =
    goalId === undefined
      ? undefined
      : db
          .select()
          .from(goals)
          .where(and(eq(goals.id, goalId), eq(goals.learnerId, learner.id)))
          .get();
  return goal ? { learner, goal } : { error: "goalNotFound" };
}

/** The Term with key `termKey` in the Learner's Curriculum, with its Subject. */
function termOf(curriculaDir: string, learner: LearnerRow, termKey: string): { subject: Subject; term: Term } | undefined {
  for (const subject of curriculumOf(curriculaDir, learner)?.subjects ?? []) {
    const term = subject.terms.find((t) => t.key === termKey);
    if (term) return { subject, term };
  }
  return undefined;
}

/** A Goal not saved yet; its position comes from its place in the queue. */
type NewGoal = Omit<GoalRow, "id" | "position">;
type QueueEntry = GoalRow | NewGoal;

/** One Learner's Goal queue for a Subject, in order. */
function subjectQueue(db: DbReader, learnerId: number, subjectKey: string): GoalRow[] {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.learnerId, learnerId), eq(goals.subjectKey, subjectKey)))
    .orderBy(goals.position, goals.id)
    .all();
}

/** One Subject's whole queue in the order of `goalIds`; undefined unless they are exactly that queue's Goals, each once. */
function reorderedQueue(db: DbReader, learner: LearnerRow, goalIds: unknown): GoalRow[] | undefined {
  if (!Array.isArray(goalIds) || !goalIds.every((id): id is number => typeof id === "number")) return undefined;
  const first = goalIds[0] === undefined ? undefined : db.select().from(goals).where(eq(goals.id, goalIds[0])).get();
  if (first?.learnerId !== learner.id) return undefined;
  const byId = new Map(subjectQueue(db, learner.id, first.subjectKey).map((goal) => [goal.id, goal]));
  const queue = goalIds.map((id) => byId.get(id));
  if (queue.length !== byId.size || new Set(goalIds).size !== byId.size || queue.some((goal) => !goal)) return undefined;
  return queue as GoalRow[];
}

/**
 * Saves a Subject's queue as given: new Goals are created, and every Goal takes its place in the order and its Target Date.
 * Returns the saved Goals in queue order.
 */
function saveQueue(db: Db, queue: QueueEntry[]): GoalRow[] {
  return db.transaction((tx) =>
    queue.map((entry, i) => {
      const position = i + 1;
      return "id" in entry
        ? tx.update(goals).set({ position, targetDate: entry.targetDate }).where(eq(goals.id, entry.id)).returning().get()!
        : tx
            .insert(goals)
            .values({ ...entry, position })
            .returning()
            .get();
    }),
  );
}

/**
 * Each Lesson and Unit Test of the Subject by its place in Curriculum order, a Unit Test right after its Unit's last Lesson.
 * Keys no longer in the Curriculum have no place.
 */
function curriculumPlaces(subject: Subject): Map<string, number> {
  const places = new Map<string, number>();
  let place = 0;
  for (const unit of subject.terms.flatMap((t) => t.units)) {
    for (const lesson of unit.lessons) places.set(lesson.key, place++);
    places.set(unit.key, place - 0.5);
  }
  return places;
}

/**
 * Spreads Target Dates evenly from today to the Term's end date over the Term's Lessons still to be met, in queue order;
 * the last lands on the end date. A Lesson with no Goal yet gets one, queued after the Goal of the nearest earlier Lesson
 * in Curriculum order, so the Parent's own ordering is kept. Met and skipped Lessons are left alone.
 */
function spreadTargetDates(db: Db, learner: LearnerRow, subject: Subject, term: Term, today: string, termEndDate: string) {
  const places = curriculumPlaces(subject);
  const queue: QueueEntry[] = subjectQueue(db, learner.id, subject.key);
  const termLessons = term.units.flatMap((u) => u.lessons).map((l) => l.key);
  for (const lessonKey of termLessons) {
    if (queue.some((goal) => goal.kind === "lesson" && goal.curriculumKey === lessonKey)) continue;
    const place = places.get(lessonKey)!;
    let after = -1;
    queue.forEach((goal, i) => {
      if ((places.get(goal.curriculumKey) ?? Infinity) < place) after = i;
    });
    queue.splice(after + 1, 0, {
      learnerId: learner.id,
      subjectKey: subject.key,
      curriculumKey: lessonKey,
      kind: "lesson",
      targetDate: termEndDate,
      status: "active",
    });
  }

  const remaining = queue.filter((goal) => goal.kind === "lesson" && termLessons.includes(goal.curriculumKey) && isToBeMet(goal.status));
  const days = daysBetween(today, termEndDate);
  const dates = new Map(remaining.map((goal, i) => [goal, addDays(today, Math.floor(((i + 1) * days) / remaining.length))]));
  saveQueue(
    db,
    queue.map((goal) => ({ ...goal, targetDate: dates.get(goal) ?? goal.targetDate })),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one YYYY-MM-DD date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The YYYY-MM-DD date `days` after `date`. */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whether `value` is a real day written YYYY-MM-DD. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
}

/** A Goal row as the API shows it; a Goal whose Lesson is gone from the Curriculum falls back to its key. */
function toGoal(row: GoalRow, target: Target | undefined, today: string): Goal {
  const { id, subjectKey, curriculumKey, kind, targetDate, status } = row;
  return {
    id,
    subjectKey,
    subjectName: target?.subjectName ?? subjectKey,
    lessonKey: curriculumKey,
    kind,
    title: target?.title ?? curriculumKey,
    targetDate,
    status,
    overdue: isOverdue(row, today),
  };
}
