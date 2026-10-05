import type { Db } from "./db";

/** What the app needs from the outside world; tests pass in-memory or fake versions. */
export type AppDeps = { db: Db };
