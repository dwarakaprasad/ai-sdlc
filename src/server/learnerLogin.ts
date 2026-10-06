import { Hono } from "hono";
import type { LearnerProfile, LoggedInLearner } from "../shared/api";
import type { AppDeps } from "./deps";
import { currentLogin, endLogin, requireRole, startLogin, verifyPassword } from "./auth";
import { allLearners, findLearner, hasPin, readJsonObject } from "./learners";

/** The Learner login screen and the logged-in Learner's own routes. */
export function learnerRoutes({ db }: AppDeps) {
  const protectedRoutes = new Hono().use(requireRole(db, "learner")).get("/me", (c) => {
    const learnerId = currentLogin(c, db)?.learnerId;
    const learner = learnerId == null ? undefined : findLearner(db, learnerId);
    if (!learner) return c.json({ error: "notLoggedIn" }, 401);
    const me: LoggedInLearner = { id: learner.id, name: learner.name };
    return c.json(me);
  });

  return new Hono()
    .get("/profiles", (c) =>
      c.json(allLearners(db).map((learner): LearnerProfile => ({ id: learner.id, name: learner.name, hasPin: hasPin(learner) }))),
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
