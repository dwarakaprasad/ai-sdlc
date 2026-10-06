import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { loadCurricula } from "../curriculum";
import { PIN_PATTERN } from "../shared/auth";
import {
  ACCENT_COLORS,
  isAccentColor,
  isAvatarId,
  needsAttention,
  type AccentColor,
  type AvatarChoice,
  type Learner,
  type LearnerInput,
  type LearnerProfile,
  type LoggedInLearner,
} from "../shared/api";
import type { AppDeps } from "./deps";
import { currentLogin, hashPassword } from "./auth";
import { goalsOf } from "./goals";
import { parseId, readJsonObject } from "./http";
import type { Db } from "./db";
import { learners } from "./db/schema";

export type LearnerRow = typeof learners.$inferSelect;

/** Every Learner, in the order the Parent and the login screen show them. */
export function allLearners(db: Db): LearnerRow[] {
  return db.select().from(learners).orderBy(learners.name, learners.id).all();
}

export function findLearner(db: Db, id: number): LearnerRow | undefined {
  return db.select().from(learners).where(eq(learners.id, id)).get();
}

/** The Learner this browser is logged in as, if any. */
export function loggedInLearner(db: Db, c: Context): LearnerRow | undefined {
  const learnerId = currentLogin(c, db)?.learnerId;
  return learnerId == null ? undefined : findLearner(db, learnerId);
}

/** The Learner named by the `:id` path parameter, if it is a number and such a Learner exists. */
export function learnerFromPath(db: Db, c: Context): LearnerRow | undefined {
  const id = parseId(c.req.param("id"));
  return id === undefined ? undefined : findLearner(db, id);
}

export function hasPin(learner: LearnerRow): boolean {
  return learner.pinHash !== null;
}

/** A Learner's Avatar and its colour, as every view of a Learner shows them. */
function avatarOf({ avatar, color }: LearnerRow): AvatarChoice {
  return { avatar, color };
}

/** A Learner's profile on the login screen: no private details. */
export function toLearnerProfile(row: LearnerRow): LearnerProfile {
  return { id: row.id, name: row.name, hasPin: hasPin(row), ...avatarOf(row) };
}

/** The logged-in Learner, as they see themselves. */
export function toLoggedInLearner(row: LearnerRow): LoggedInLearner {
  return { id: row.id, name: row.name, ...avatarOf(row) };
}

/** Saves a Learner's own pick of Avatar and colour, answering with the Learner as they now are. */
export function saveAvatar(db: Db, learner: LearnerRow, choice: { avatar: NonNullable<AvatarChoice["avatar"]>; color: AccentColor }): LearnerRow {
  return db.update(learners).set(choice).where(eq(learners.id, learner.id)).returning().get()!;
}

/**
 * The colour a new Learner gets, so siblings differ by default: the one fewest Learners have, earliest in palette order
 * on a tie. Learners added one after another get the colours in palette order.
 */
function nextColor(db: Db): AccentColor {
  const used = allLearners(db).map((l) => l.color);
  const count = (color: AccentColor) => used.filter((c) => c === color).length;
  return ACCENT_COLORS.reduce((least, color) => (count(color) < count(least) ? color : least));
}

/** The Parent's Learner management, mounted under the Parent's protected routes. */
export function parentLearnerRoutes(deps: AppDeps) {
  const { db, curriculaDir } = deps;
  const toLearner = (row: LearnerRow) => learnerAsParentSees(deps, row);
  const isValidCurriculum = (id: string) => loadCurricula(curriculaDir).some((r) => r.ok && r.id === id);
  return new Hono()
    .get("/", (c) => c.json(allLearners(db).map(toLearner)))
    .post("/", async (c) => {
      const input = await readLearnerInput(c);
      if ("error" in input) return c.json(input, 400);
      if (!isValidCurriculum(input.curriculumId)) return c.json({ error: "unknownCurriculum" }, 400);
      const { pin, avatar, color, ...fields } = input;
      const row = db
        .insert(learners)
        .values({ ...fields, avatar: avatar ?? null, color: color ?? nextColor(db), pinHash: pin ? await hashPassword(pin) : null })
        .returning()
        .get();
      return c.json(toLearner(row), 201);
    })
    .put("/:id", async (c) => {
      const existing = learnerFromPath(db, c);
      if (!existing) return c.json({ error: "learnerNotFound" }, 404);
      const input = await readLearnerInput(c);
      if ("error" in input) return c.json(input, 400);
      // Only a change of Curriculum is checked, so a Learner can still be renamed while their Curriculum is being fixed.
      if (input.curriculumId !== existing.curriculumId && !isValidCurriculum(input.curriculumId)) {
        return c.json({ error: "unknownCurriculum" }, 400);
      }
      // An absent PIN, Avatar or colour keeps the current one.
      const { pin, avatar = existing.avatar, color = existing.color, ...fields } = input;
      const pinHash = pin === undefined ? existing.pinHash : pin === null ? null : await hashPassword(pin);
      const row = db
        .update(learners)
        .set({ ...fields, avatar, color, pinHash })
        .where(eq(learners.id, existing.id))
        .returning()
        .get();
      return c.json(toLearner(row!));
    })
    .delete("/:id", (c) => {
      const existing = learnerFromPath(db, c);
      if (!existing) return c.json({ error: "learnerNotFound" }, 404);
      db.delete(learners).where(eq(learners.id, existing.id)).run();
      return c.body(null, 204);
    });
}

function learnerAsParentSees(deps: AppDeps, row: LearnerRow): Learner {
  const { id, name, grade, curriculumId } = row;
  const attention = goalsOf(deps, row).filter(needsAttention).length;
  return { id, name, grade, curriculumId, hasPin: hasPin(row), needsAttention: attention, ...avatarOf(row) };
}

type LearnerInputError = {
  error: "invalidBody" | "nameRequired" | "gradeRequired" | "unknownCurriculum" | "invalidPin" | "unknownAvatar" | "unknownColor";
};

/** The validated Learner fields from a JSON body, or the error describing what's wrong. */
async function readLearnerInput(c: Context): Promise<LearnerInput | LearnerInputError> {
  const body = await readJsonObject(c);
  if (!body) return { error: "invalidBody" };
  const { name, grade, curriculumId, pin, avatar, color } = body;
  if (typeof name !== "string" || name.trim() === "") return { error: "nameRequired" };
  if (typeof grade !== "string" || grade.trim() === "") return { error: "gradeRequired" };
  if (typeof curriculumId !== "string") return { error: "unknownCurriculum" };
  if (pin !== undefined && pin !== null && (typeof pin !== "string" || !PIN_PATTERN.test(pin))) {
    return { error: "invalidPin" };
  }
  if (avatar !== undefined && avatar !== null && !isAvatarId(avatar)) return { error: "unknownAvatar" };
  if (color !== undefined && !isAccentColor(color)) return { error: "unknownColor" };
  return { name: name.trim(), grade: grade.trim(), curriculumId, pin, avatar, color };
}
