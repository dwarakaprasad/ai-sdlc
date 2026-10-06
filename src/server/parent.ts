import { Hono, type Context } from "hono";
import { MIN_PASSWORD_LENGTH } from "../shared/auth";
import type { ParentStatus } from "../shared/api";
import type { AppDeps } from "./deps";
import { currentRole, endLogin, forbidRole, hashPassword, requireRole, startLogin, verifyPassword } from "./auth";
import { listCurricula } from "./curricula";
import { parentGoalRoutes } from "./goals";
import { parentLearnerRoutes } from "./learners";
import { parentProgressRoutes } from "./progress";
import { parentSettingsRoutes } from "./settings";
import { parentUsageRoutes } from "./usage";
import { parentCredential } from "./db/schema";

export function parentRoutes(deps: AppDeps) {
  const { db, curriculaDir } = deps;
  const isPasswordSet = () => db.select().from(parentCredential).get() !== undefined;

  // Everything mounted here requires a logged-in Parent.
  const protectedRoutes = new Hono()
    .use(requireRole(db, "parent"))
    .get("/curricula", (c) => c.json(listCurricula(curriculaDir)))
    .route("/learners", parentLearnerRoutes(deps))
    .route("/learners/:id", parentGoalRoutes(deps))
    .route("/learners/:id", parentProgressRoutes(deps))
    .route("/settings", parentSettingsRoutes(deps))
    .route("/usage", parentUsageRoutes(deps));

  // A Learner can't reach any Parent endpoint, not even the login form: they log out first.
  return new Hono()
    .use(forbidRole(db, "learner"))
    .get("/status", (c) => {
      const status: ParentStatus = { passwordSet: isPasswordSet(), loggedIn: currentRole(c, db) === "parent" };
      return c.json(status);
    })
    .post("/setup", async (c) => {
      const password = await readPassword(c);
      if (password === undefined || password.length < MIN_PASSWORD_LENGTH) {
        return c.json({ error: "passwordTooShort" }, 400);
      }
      if (isPasswordSet()) return c.json({ error: "passwordAlreadySet" }, 409);
      const passwordHash = await hashPassword(password);
      // The fixed id makes a racing second setup a no-op rather than a second credential.
      const { changes } = db.insert(parentCredential).values({ id: 1, passwordHash }).onConflictDoNothing().run();
      if (changes === 0) return c.json({ error: "passwordAlreadySet" }, 409);
      startLogin(c, db, { role: "parent" });
      return c.body(null, 201);
    })
    .post("/login", async (c) => {
      const password = (await readPassword(c)) ?? "";
      const credential = db.select().from(parentCredential).get();
      if (!credential || !(await verifyPassword(password, credential.passwordHash))) {
        return c.json({ error: "wrongPassword" }, 401);
      }
      startLogin(c, db, { role: "parent" });
      return c.body(null, 204);
    })
    .post("/logout", (c) => {
      endLogin(c, db);
      return c.body(null, 204);
    })
    .route("/", protectedRoutes);
}

/** The `password` string from a JSON body, or undefined when the body is malformed. */
async function readPassword(c: Context): Promise<string | undefined> {
  const body: unknown = await c.req.json().catch(() => undefined);
  if (typeof body !== "object" || body === null || !("password" in body)) return undefined;
  return typeof body.password === "string" ? body.password : undefined;
}
