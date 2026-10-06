import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { GOAL_KINDS, GOAL_STATUSES } from "../../shared/api";

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

/** The Parent's settings; at most one row (id = 1), and defaults apply until the Parent saves. No API key is ever stored (ADR 0002). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
});

/** Tokens used by one LLM call, dated by the server's local day so daily totals match the household's day. */
export const llmUsage = sqliteTable("llm_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** YYYY-MM-DD. */
  date: text("date").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * A Learner's Goal: master one Lesson, or pass one Unit Test, by a Target Date.
 * Overdue is worked out from the Target Date when needed, never stored.
 */
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  learnerId: integer("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  subjectKey: text("subject_key").notNull(),
  /** The Lesson key for a lesson Goal, the Unit key for a unit-test Goal; may no longer exist after a Curriculum edit. */
  curriculumKey: text("curriculum_key").notNull(),
  kind: text("kind", { enum: GOAL_KINDS }).notNull(),
  /** Place in the Learner's queue for this Subject; lowest first. */
  position: integer("position").notNull(),
  /** YYYY-MM-DD. */
  targetDate: text("target_date").notNull(),
  status: text("status", { enum: GOAL_STATUSES }).notNull(),
});
