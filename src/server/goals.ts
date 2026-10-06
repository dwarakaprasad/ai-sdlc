import { and, eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { join } from "node:path";
import { loadCurriculum, type Curriculum, type Lesson, type Subject } from "../curriculum";
import type { Goal, GoalCard, GoalKind, GoalStatus, LessonOption } from "../shared/api";
import type { AppDeps } from "./deps";
import { readJsonObject } from "./http";
import { learnerFromPath, type LearnerRow } from "./learners";
import { localDate } from "./usage";
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
    subject.terms
      .flatMap((t) => t.units)
      .flatMap((unit) =>
        unit.lessons.map((lesson) => ({ key: lesson.key, subjectName: subject.name, unitTitle: unit.title, title: lesson.title })),
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
      const { lessonKey, targetDate } = body;
      const target = typeof lessonKey === "string" ? targetsFor(curriculaDir, learner).get(lessonKey) : undefined;
      if (target?.kind !== "lesson" || typeof lessonKey !== "string") return c.json({ error: "unknownLesson" }, 400);
      if (typeof targetDate !== "string" || !isCalendarDate(targetDate)) return c.json({ error: "invalidTargetDate" }, 400);

      // A new Goal joins the end of its Subject's queue.
      const last = db
        .select({ position: max(goals.position) })
        .from(goals)
        .where(and(eq(goals.learnerId, learner.id), eq(goals.subjectKey, target.subjectKey)))
        .get();
      const row = db
        .insert(goals)
        .values({
          learnerId: learner.id,
          subjectKey: target.subjectKey,
          curriculumKey: lessonKey,
          kind: "lesson",
          position: (last?.position ?? 0) + 1,
          targetDate,
          status: "active",
        })
        .returning()
        .get();
      return c.json(toGoal(row, target, localDate(now())), 201);
    });
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
