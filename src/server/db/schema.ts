import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Who a login belongs to. */
export const roles = ["parent", "learner"] as const;

/** The single Parent's password hash; at most one row (id = 1). */
export const parentCredential = sqliteTable("parent_credential", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
});

/**
 * Logged-in browsers, identified by an opaque cookie token.
 * Called "logins" so they aren't confused with a tutoring Session (see CONTEXT.md).
 */
export const logins = sqliteTable("logins", {
  token: text("token").primaryKey(),
  role: text("role", { enum: roles }).notNull(),
  /** Set for a Learner login; removing the Learner logs them out. */
  learnerId: integer("learner_id").references(() => learners.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** A child being taught, following one Curriculum (by folder name). */
export const learners = sqliteTable("learners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  curriculumId: text("curriculum_id").notNull(),
  /** Hashed like the Parent password; null when the Learner has no PIN. */
  pinHash: text("pin_hash"),
});
