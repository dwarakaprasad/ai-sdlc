import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { join } from "node:path";
import { loadCurriculum, type Curriculum, type Subject, type Term } from "../curriculum";
import type {
  Goal,
  GoalCard,
  GoalKind,
  GoalStatus,
  LearnerToday,
  LearningPath,
  LessonOption,
  PathNode,
  PathState,
  SubjectToday,
  TermProgress,
} from "../shared/api";
import type { AppDeps } from "./deps";
import { parseId, readJsonObject } from "./http";
import { learnerFromPath, type LearnerRow } from "./learners";
import { localDate } from "./usage";
import type { Db, DbReader, DbWriter } from "./db";
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
          subjectKey: subject.key,
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

/**
 * Every Lesson and Unit in the Learner's Curriculum by key; undefined while the Curriculum is invalid or missing, when no Goal
 * can be told apart as orphaned.
 */
function targetsFor(curriculaDir: string, learner: LearnerRow): Map<string, Target> | undefined {
  const curriculum = curriculumOf(curriculaDir, learner);
  if (!curriculum) return undefined;
  const targets = new Map<string, Target>();
  for (const subject of curriculum.subjects) {
    for (const unit of subject.terms.flatMap((t) => t.units)) {
      const at = { subjectKey: subject.key, subjectName: subject.name };
      targets.set(unit.key, { kind: "unit-test", ...at, title: unit.title });
      for (const lesson of unit.lessons) targets.set(lesson.key, { kind: "lesson", ...at, title: lesson.title });
    }
  }
  return targets;
}

/** What a Goal teaches and tests, with its Subject: one Lesson's Learning Objectives, or for a Unit Test every one of its Unit's. */
export type GoalContent = { subject: Subject; kind: GoalKind; title: string; learningObjectives: string[] };

/** What a Goal teaches and tests; undefined while its Lesson or Unit, or the Curriculum, is gone or invalid. */
export function contentOfGoal(curriculaDir: string, learner: LearnerRow, goal: GoalRow): GoalContent | undefined {
  const subject = curriculumOf(curriculaDir, learner)?.subjects.find((s) => s.key === goal.subjectKey);
  if (!subject) return undefined;
  for (const unit of subject.terms.flatMap((t) => t.units)) {
    if (goal.kind === "unit-test" && unit.key === goal.curriculumKey) {
      // Two Lessons may share a Learning Objective; the Unit Test tests it once.
      const learningObjectives = [...new Set(unit.lessons.flatMap((l) => l.learningObjectives))];
      return { subject, kind: goal.kind, title: unit.title, learningObjectives };
    }
    const lesson = goal.kind === "lesson" ? unit.lessons.find((l) => l.key === goal.curriculumKey) : undefined;
    if (lesson) return { subject, kind: goal.kind, title: lesson.title, learningObjectives: lesson.learningObjectives };
  }
  return undefined;
}

/**
 * Marks a Goal met and moves its Subject's queue on, inside the caller's transaction. Once every Lesson of a met Lesson's
 * Unit is met, the Unit's Unit Test is the next Goal, ahead of anything the Parent queued. Otherwise, while the Parent has
 * queued nothing else still to be met, the first Lesson in Curriculum order from the Unit's start (on into the next Term)
 * that has no Goal yet joins the end of the queue as the next Goal. A new Goal takes the met Goal's Target Date, or today if that has passed,
 * so it never starts overdue.
 */
export function meetGoal(db: DbWriter, subject: Subject, goal: GoalRow, today: string): void {
  db.update(goals).set({ status: "met" }).where(eq(goals.id, goal.id)).run();
  const units = subject.terms.flatMap((t) => t.units);
  const unit = units.find((u) => u.key === goal.curriculumKey || u.lessons.some((l) => l.key === goal.curriculumKey));
  if (!unit) return;

  const queue: QueueEntry[] = subjectQueue(db, goal.learnerId, subject.key);
  /** Whether the Lesson has a Goal in the queue, one with `status` if given. */
  const hasGoal = (lessonKey: string, status?: GoalStatus) =>
    queue.some((g) => g.kind === "lesson" && g.curriculumKey === lessonKey && (status === undefined || g.status === status));
  const unitTestDue =
    goal.kind === "lesson" &&
    unit.lessons.every((l) => hasGoal(l.key, "met")) &&
    !queue.some((g) => g.kind === "unit-test" && g.curriculumKey === unit.key && g.status !== "skipped");
  const targetDate = goal.targetDate < today ? today : goal.targetDate;

  if (unitTestDue) {
    queue.splice(queue.findIndex((g) => "id" in g && g.id === goal.id) + 1, 0, newGoal(goal.learnerId, subject.key, "unit-test", unit.key, targetDate));
    saveQueue(db, queue);
    return;
  }
  if (queue.some((g) => isToBeMet(g.status))) return;
  const lessons = units.flatMap((u) => u.lessons);
  // From the Unit's first Lesson, so one left behind (the Parent started the Unit part-way) comes before the next Unit.
  const from = lessons.findIndex((l) => l.key === unit.lessons[0]?.key);
  const lesson = lessons.slice(from).find((l) => !hasGoal(l.key));
  if (!lesson) return;
  queue.push(newGoal(goal.learnerId, subject.key, "lesson", lesson.key, targetDate));
  saveQueue(db, queue);
}

/** Overdue: the Target Date has passed and the Goal is still to be met. Never stored, so it is always current. */
function isOverdue(row: GoalRow, today: string): boolean {
  return isToBeMet(row.status) && row.targetDate < today;
}

/** Active or Flagged: neither met nor skipped. */
function isToBeMet(status: GoalStatus): boolean {
  return status === "active" || status === "flagged";
}

/**
 * Orphaned: a Goal still to be met whose Lesson or Unit is gone from a Curriculum that is otherwise valid. Never stored.
 * A met or skipped Goal is history, not work, so it is never orphaned and its Sessions stay as they are.
 */
function isOrphaned(row: GoalRow, targets: Map<string, Target> | undefined): targets is Map<string, Target> {
  return targets !== undefined && isToBeMet(row.status) && !targets.has(row.curriculumKey);
}

/** A Learner's Goals with their Lesson or Unit titles, each Subject's queue in order. */
export function goalsOf({ db, curriculaDir, now }: AppDeps, learner: LearnerRow): Goal[] {
  const targets = targetsFor(curriculaDir, learner);
  const today = localDate(now());
  return db
    .select()
    .from(goals)
    .where(eq(goals.learnerId, learner.id))
    .orderBy(goals.subjectKey, goals.position, goals.id)
    .all()
    .map((row) => toGoal(row, targets, today));
}

/**
 * The Learner's home data: for each Subject with any Goal, its current Goal (the first in its queue still to be met) as a
 * card, and its current Term's progress; and how many Goals the Learner has met. A Flagged or Orphaned current Goal waits
 * for the Parent, so its Subject stays, marked as with the Parent, with no card to start until the Parent resolves it.
 */
export function learnerToday(deps: AppDeps, learner: LearnerRow): LearnerToday {
  const learnerGoals = goalsOf(deps, learner);
  const curriculumSubjects = curriculumOf(deps.curriculaDir, learner)?.subjects ?? [];
  // goalsOf keeps each Subject's queue in order.
  const queues = new Map<string, Goal[]>();
  for (const goal of learnerGoals) queues.set(goal.subjectKey, [...(queues.get(goal.subjectKey) ?? []), goal]);
  const subjects = [...queues].map(([subjectKey, queue]): SubjectToday => {
    const current = queue.find((goal) => isToBeMet(goal.status));
    const withParent = current !== undefined && (current.status === "flagged" || current.orphaned);
    const subject = curriculumSubjects.find((s) => s.key === subjectKey);
    return {
      subjectKey,
      subjectName: subject?.name ?? queue[0]!.subjectName,
      card: current && !withParent ? toGoalCard(current) : null,
      withParent,
      term: subject ? termProgress(subject, queue, current) : null,
    };
  });
  // Subjects to start first (earliest Target Date leading), then any with nothing left to meet, then those with the Parent.
  const rank = (s: SubjectToday) => (s.card ? 0 : s.withParent ? 2 : 1);
  subjects.sort(
    (a, b) =>
      rank(a) - rank(b) || (a.card && b.card ? a.card.targetDate.localeCompare(b.card.targetDate) : 0) || a.subjectName.localeCompare(b.subjectName),
  );
  return { subjects, goalsMet: learnerGoals.filter((goal) => goal.status === "met").length };
}

function toGoalCard({ id, kind, subjectName, title, targetDate, overdue }: Goal): GoalCard {
  return { id, kind, subjectName, title, targetDate, overdue };
}

/** The Term holding a Lesson, or the Unit of a Unit Test, by its key. */
export function termHolding(subject: Subject, key: string): Term | undefined {
  return subject.terms.find((term) => term.units.some((unit) => unit.key === key || unit.lessons.some((lesson) => lesson.key === key)));
}

/**
 * A Subject's current Term: the current Goal's; when there's none (or it's Orphaned, so has no Term), the Term of the last
 * met Goal. No time is kept for when a Goal was met, so the last met is the last in queue order, the order it was worked in.
 */
export function currentTermOf(subject: Subject, queue: Goal[], current: Goal | undefined): Term | undefined {
  const lastMet = [...queue].reverse().find((goal) => goal.status === "met" && termHolding(subject, goal.lessonKey));
  return (current && termHolding(subject, current.lessonKey)) ?? (lastMet && termHolding(subject, lastMet.lessonKey));
}

/**
 * A Subject's Learning Path: its current Term in Curriculum order, each Lesson and Unit Test shown by the state of its Goal.
 * Undefined when the Subject isn't in the Learner's Curriculum (or the Curriculum is invalid), or has no current Term.
 */
export function learningPathOf(deps: AppDeps, learner: LearnerRow, subjectKey: string): LearningPath | undefined {
  const subject = curriculumOf(deps.curriculaDir, learner)?.subjects.find((s) => s.key === subjectKey);
  if (!subject) return undefined;
  const queue = goalsOf(deps, learner).filter((goal) => goal.subjectKey === subjectKey);
  const current = queue.find((goal) => isToBeMet(goal.status));
  const term = currentTermOf(subject, queue, current);
  if (!term) return undefined;

  /**
   * A node from its Goals; a Lesson may have had several (say, one met and the same Lesson set again). The current Goal
   * decides first, even out of Curriculum order, since the Goal queue, not the Path, says what's next; then any met Goal,
   * a Flagged one, a skipped one; otherwise the node is ahead.
   */
  const node = (kind: GoalKind, key: string, title: string): PathNode => {
    const own = queue.filter((goal) => goal.kind === kind && goal.lessonKey === key);
    if (current && own.includes(current)) {
      // An Orphaned Goal's key is gone from the Curriculum, so only a Flagged current Goal can be with the Parent here.
      return current.status === "flagged" ? { key, kind, title, state: "with-parent" } : { key, kind, title, state: "current", goalId: current.id };
    }
    const state: PathState = own.some((goal) => goal.status === "met")
      ? "met"
      : own.some((goal) => goal.status === "flagged")
        ? "with-parent"
        : own.some((goal) => goal.status === "skipped")
          ? "skipped"
          : "ahead";
    return { key, kind, title, state };
  };
  return {
    subjectName: subject.name,
    termName: term.name,
    units: term.units.map((unit) => ({
      key: unit.key,
      title: unit.title,
      nodes: [...unit.lessons.map((lesson) => node("lesson", lesson.key, lesson.title)), node("unit-test", unit.key, unit.title)],
    })),
  };
}

/** A Subject's current Term with its met Lessons and Unit Tests (each once, however many Goals met it) out of all of them. */
function termProgress(subject: Subject, queue: Goal[], current: Goal | undefined): TermProgress | null {
  const term = currentTermOf(subject, queue, current);
  if (!term) return null;
  const total = term.units.reduce((sum, unit) => sum + unit.lessons.length + 1, 0);
  const metKeys = new Set(queue.filter((goal) => goal.status === "met" && termHolding(subject, goal.lessonKey) === term).map((goal) => goal.lessonKey));
  return { termName: term.name, met: metKeys.size, total };
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
      const targets = targetsFor(curriculaDir, learner);
      const target = typeof lessonKey === "string" ? targets?.get(lessonKey) : undefined;
      if (target?.kind !== "lesson" || typeof lessonKey !== "string") return c.json({ error: "unknownLesson" }, 400);
      if (typeof targetDate !== "string" || !isCalendarDate(targetDate)) return c.json({ error: "invalidTargetDate" }, 400);

      const queue: QueueEntry[] = subjectQueue(db, learner.id, target.subjectKey);
      // Two Goals for one Lesson would each take a slot when Target Dates are spread.
      if (queue.some((goal) => goal.kind === "lesson" && goal.curriculumKey === lessonKey && isToBeMet(goal.status))) {
        return c.json({ error: "lessonHasGoal" }, 409);
      }
      // A new Goal joins the end of its Subject's queue, unless the Parent inserts it before one of that Subject's Goals.
      const place = beforeGoalId === undefined ? queue.length : queue.findIndex((goal) => "id" in goal && goal.id === beforeGoalId);
      if (place === -1) return c.json({ error: "invalidPosition" }, 400);
      queue.splice(place, 0, newGoal(learner.id, target.subjectKey, "lesson", lessonKey, targetDate));
      const row = db.transaction((tx) => saveQueue(tx, queue))[place]!;
      return c.json(toGoal(row, targets, localDate(now())), 201);
    })
    .post("/goals/spread", async (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const body = await readJsonObject(c);
      if (!body) return c.json({ error: "invalidBody" }, 400);
      const { termKey, termEndDate } = body;
      const located = typeof termKey === "string" ? termOf(curriculaDir, learner, termKey) : undefined;
      if (!located) return c.json({ error: "unknownTerm" }, 400);
      if (typeof termEndDate !== "string" || !isCalendarDate(termEndDate)) return c.json({ error: "invalidTermEndDate" }, 400);
      const today = localDate(now());
      if (termEndDate < today) return c.json({ error: "termEndDatePassed" }, 400);
      db.transaction((tx) => spreadTargetDates(tx, learner, located.subject, located.term, today, termEndDate));
      return c.json(goalsOf(deps, learner));
    })
    .put("/goals/order", async (c) => {
      const learner = learnerFromPath(db, c);
      if (!learner) return c.json({ error: "learnerNotFound" }, 404);
      const { goalIds } = (await readJsonObject(c)) ?? {};
      const queue = reorderedQueue(db, learner, goalIds);
      if (!queue) return c.json({ error: "invalidOrder" }, 400);
      db.transaction((tx) => saveQueue(tx, queue));
      return c.json(goalsOf(deps, learner));
    })
    .patch("/goals/:goalId", async (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      const { targetDate } = (await readJsonObject(c)) ?? {};
      if (typeof targetDate !== "string" || !isCalendarDate(targetDate)) return c.json({ error: "invalidTargetDate" }, 400);
      return c.json(changeGoal(found, { targetDate }));
    })
    .post("/goals/:goalId/skip", (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      // A Flagged Goal can be skipped too: that is one way the Parent resolves it.
      if (!isToBeMet(found.goal.status)) return c.json({ error: "goalNotActive" }, 409);
      return c.json(changeGoal(found, { status: "skipped" }));
    })
    .post("/goals/:goalId/retry", (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      if (found.goal.status !== "flagged") return c.json({ error: "goalNotFlagged" }, 409);
      // Its Session ended when it was flagged, so the Learner's next tap starts afresh with the Explanation.
      return c.json(changeGoal(found, { status: "active" }));
    })
    .post("/goals/:goalId/met", (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      if (found.goal.status !== "flagged") return c.json({ error: "goalNotFlagged" }, 409);
      const content = contentOfGoal(curriculaDir, found.learner, found.goal);
      if (!content) return c.json({ error: "lessonUnavailable" }, 409);
      // The Parent taught it themselves: the queue moves on exactly as if the Learner had passed the Quiz.
      db.transaction((tx) => meetGoal(tx, content.subject, found.goal, localDate(now())));
      return c.json(goalNow(found));
    })
    .post("/goals/:goalId/repoint", async (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      const { learner, goal } = found;
      const targets = targetsFor(curriculaDir, learner);
      if (!isOrphaned(goal, targets)) return c.json({ error: "goalNotOrphaned" }, 409);
      const { lessonKey } = (await readJsonObject(c)) ?? {};
      const target = typeof lessonKey === "string" ? targets.get(lessonKey) : undefined;
      if (target?.kind !== goal.kind || typeof lessonKey !== "string") return c.json({ error: "unknownLesson" }, 400);
      const repointed = db.transaction((tx) => {
        const queue = subjectQueue(tx, learner.id, target.subjectKey);
        if (queue.some((g) => g.kind === goal.kind && g.curriculumKey === lessonKey && isToBeMet(g.status))) return false;
        // A Goal re-pointed into another Subject joins the end of that Subject's queue.
        const position = target.subjectKey === goal.subjectKey ? goal.position : Math.max(0, ...queue.map((g) => g.position)) + 1;
        tx.update(goals).set({ curriculumKey: lessonKey, subjectKey: target.subjectKey, position }).where(eq(goals.id, goal.id)).run();
        return true;
      });
      if (!repointed) return c.json({ error: "lessonHasGoal" }, 409);
      return c.json(goalNow(found));
    })
    .delete("/goals/:goalId", (c) => {
      const found = goalFromPath(db, c);
      if ("error" in found) return c.json(found, 404);
      // Only an orphaned Goal can be removed (with its Sessions); any other is skipped instead, keeping its history.
      if (!isOrphaned(found.goal, targetsFor(curriculaDir, found.learner))) return c.json({ error: "goalNotOrphaned" }, 409);
      db.delete(goals).where(eq(goals.id, found.goal.id)).run();
      return c.body(null, 204);
    });

  /** Saves `change` to one of the Learner's Goals, and answers with the Goal as it now is. */
  function changeGoal(found: { learner: LearnerRow; goal: GoalRow }, change: Partial<Pick<GoalRow, "targetDate" | "status">>): Goal {
    db.update(goals).set(change).where(eq(goals.id, found.goal.id)).run();
    return goalNow(found);
  }

  /** One of the Learner's Goals as it now is. */
  function goalNow({ learner, goal }: { learner: LearnerRow; goal: GoalRow }): Goal {
    const row = db.select().from(goals).where(eq(goals.id, goal.id)).get()!;
    return toGoal(row, targetsFor(curriculaDir, learner), localDate(now()));
  }
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

/** An active Goal for a Lesson, or for a Unit's Unit Test with the Unit key. */
function newGoal(learnerId: number, subjectKey: string, kind: GoalKind, curriculumKey: string, targetDate: string): NewGoal {
  return { learnerId, subjectKey, curriculumKey, kind, targetDate, status: "active" };
}

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
 * Saves a Subject's queue as given, inside the caller's transaction: new Goals are created, and every Goal takes its place
 * in the order and its Target Date. Returns the saved Goals in queue order.
 */
function saveQueue(db: DbWriter, queue: QueueEntry[]): GoalRow[] {
  return queue.map((entry, i) => {
    const position = i + 1;
    return "id" in entry
      ? db.update(goals).set({ position, targetDate: entry.targetDate }).where(eq(goals.id, entry.id)).returning().get()!
      : db
          .insert(goals)
          .values({ ...entry, position })
          .returning()
          .get();
  });
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
 * Spreads Target Dates evenly from today to the Term's end date over the Term's Goals still to be met (its Lessons and
 * Unit Tests), in queue order; the last lands on the end date. A Lesson with no Goal yet gets one, queued after the Goal
 * of the nearest earlier Lesson in Curriculum order, so the Parent's own ordering is kept. Met and skipped Goals are left alone.
 */
function spreadTargetDates(db: DbWriter, learner: LearnerRow, subject: Subject, term: Term, today: string, termEndDate: string) {
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
    queue.splice(after + 1, 0, newGoal(learner.id, subject.key, "lesson", lessonKey, termEndDate));
  }

  const termKeys = new Set([...termLessons, ...term.units.map((u) => u.key)]);
  const remaining = queue.filter((goal) => termKeys.has(goal.curriculumKey) && isToBeMet(goal.status));
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
function toGoal(row: GoalRow, targets: Map<string, Target> | undefined, today: string): Goal {
  const { id, subjectKey, curriculumKey, kind, targetDate, status } = row;
  const target = targets?.get(curriculumKey);
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
    daysLate: isOverdue(row, today) ? daysBetween(targetDate, today) : 0,
    orphaned: isOrphaned(row, targets),
  };
}
