import { Hono } from "hono";
import { isAccentColor, isAvatarId, type LearnerProfile, type LoggedInLearner } from "../shared/api";
import type { AppDeps } from "./deps";
import { endLogin, requireRole, startLogin, verifyPassword } from "./auth";
import { currentGoals } from "./goals";
import { readJsonObject } from "./http";
import { eq } from "drizzle-orm";
import { learners } from "./db/schema";
import { allLearners, avatarOf, findLearner, hasPin, loggedInLearner, type LearnerRow } from "./learners";
import { learnerSessionRoutes } from "./sessions";

/** The Learner login screen and the logged-in Learner's own routes. */
export function learnerRoutes(deps: AppDeps) {
  const { db } = deps;

  const protectedRoutes = new Hono()
    .use(requireRole(db, "learner"))
    .get("/me", (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      return c.json(toLoggedInLearner(learner));
    })
    // The Learner's own pick of Avatar and colour, first asked for at their first login.
    .put("/me/avatar", async (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      const { avatar, color } = (await readJsonObject(c)) ?? {};
      if (!isAvatarId(avatar)) return c.json({ error: "unknownAvatar" }, 400);
      if (!isAccentColor(color)) return c.json({ error: "unknownColor" }, 400);
      const row = db.update(learners).set({ avatar, color }).where(eq(learners.id, learner.id)).returning().get()!;
      return c.json(toLoggedInLearner(row));
    })
    .get("/goals", (c) => {
      const learner = loggedInLearner(db, c);
      if (!learner) return c.json({ error: "notLoggedIn" }, 401);
      return c.json(currentGoals(deps, learner));
    })
    .route("/", learnerSessionRoutes(deps));

  return new Hono()
    .get("/profiles", (c) =>
      c.json(
        allLearners(db).map((learner): LearnerProfile => ({ id: learner.id, name: learner.name, hasPin: hasPin(learner), ...avatarOf(learner) })),
      ),
    )
    .post("/login", async (c) => {
      const { learnerId, pin } = (await readJsonObject(c)) ?? {};
      const learner = typeof learnerId === "number" ? findLearner(db, learnerId) : undefined;
      if (!learner) return c.json({ error: "unknownLearner" }, 401);
      if (learner.pinHash !== null && !(typeof pin === "string" && (await verifyPassword(pin, learner.pinHash)))) {
        return c.json({ error: "wrongPin" }, 401);
      }
      startLogin(c, db, { role: "learner", learnerId: learner.id });
      return c.body(null, 204);
    })
    .post("/logout", (c) => {
      endLogin(c, db);
      return c.body(null, 204);
    })
    .route("/", protectedRoutes);
}

function toLoggedInLearner(learner: LearnerRow): LoggedInLearner {
  return { id: learner.id, name: learner.name, ...avatarOf(learner) };
}
