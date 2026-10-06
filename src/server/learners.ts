import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { loadCurricula } from "../curriculum";
import { PIN_PATTERN } from "../shared/auth";
import type { Learner, LearnerInput } from "../shared/api";
import type { AppDeps } from "./deps";
import { hashPassword } from "./auth";
import { readJsonObject } from "./http";
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

export function hasPin(learner: LearnerRow): boolean {
  return learner.pinHash !== null;
}

/** The Parent's Learner management, mounted under the Parent's protected routes. */
export function parentLearnerRoutes({ db, curriculaDir }: AppDeps) {
  const isValidCurriculum = (id: string) => loadCurricula(curriculaDir).some((r) => r.ok && r.id === id);
  const learnerFromPath = (c: Context) => {
    const id = c.req.param("id") ?? "";
    return /^\d+$/.test(id) ? findLearner(db, Number(id)) : undefined;
  };

  return new Hono()
    .get("/", (c) => c.json(allLearners(db).map(toLearner)))
    .post("/", async (c) => {
      const input = await readLearnerInput(c);
      if ("error" in input) return c.json(input, 400);
      if (!isValidCurriculum(input.curriculumId)) return c.json({ error: "unknownCurriculum" }, 400);
      const { pin, ...fields } = input;
      const row = db
        .insert(learners)
        .values({ ...fields, pinHash: pin ? await hashPassword(pin) : null })
        .returning()
        .get();
      return c.json(toLearner(row), 201);
    })
    .put("/:id", async (c) => {
      const existing = learnerFromPath(c);
      if (!existing) return c.json({ error: "learnerNotFound" }, 404);
      const input = await readLearnerInput(c);
      if ("error" in input) return c.json(input, 400);
      // Only a change of Curriculum is checked, so a Learner can still be renamed while their Curriculum is being fixed.
      if (input.curriculumId !== existing.curriculumId && !isValidCurriculum(input.curriculumId)) {
        return c.json({ error: "unknownCurriculum" }, 400);
      }
      const { pin, ...fields } = input;
      const pinHash = pin === undefined ? existing.pinHash : pin === null ? null : await hashPassword(pin);
      const row = db
        .update(learners)
        .set({ ...fields, pinHash })
        .where(eq(learners.id, existing.id))
        .returning()
        .get();
      return c.json(toLearner(row!));
    })
    .delete("/:id", (c) => {
      const existing = learnerFromPath(c);
      if (!existing) return c.json({ error: "learnerNotFound" }, 404);
      db.delete(learners).where(eq(learners.id, existing.id)).run();
      return c.body(null, 204);
    });
}

function toLearner(row: LearnerRow): Learner {
  const { id, name, grade, curriculumId } = row;
  return { id, name, grade, curriculumId, hasPin: hasPin(row) };
}

type LearnerInputError = { error: "invalidBody" | "nameRequired" | "gradeRequired" | "unknownCurriculum" | "invalidPin" };

/** The validated Learner fields from a JSON body, or the error describing what's wrong. */
async function readLearnerInput(c: Context): Promise<LearnerInput | LearnerInputError> {
  const body = await readJsonObject(c);
  if (!body) return { error: "invalidBody" };
  const { name, grade, curriculumId, pin } = body;
  if (typeof name !== "string" || name.trim() === "") return { error: "nameRequired" };
  if (typeof grade !== "string" || grade.trim() === "") return { error: "gradeRequired" };
  if (typeof curriculumId !== "string") return { error: "unknownCurriculum" };
  if (pin !== undefined && pin !== null && (typeof pin !== "string" || !PIN_PATTERN.test(pin))) {
    return { error: "invalidPin" };
  }
  return { name: name.trim(), grade: grade.trim(), curriculumId, pin };
}
