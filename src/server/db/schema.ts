import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { ACCENT_COLORS, AVATARS, GOAL_KINDS, DEFAULT_LIMIT_SETTINGS, DEFAULT_TEACHING_SETTINGS, GOAL_STATUSES, MESSAGE_ROLES, QUESTION_TYPES, SESSION_STEPS } from "../../shared/api";

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
  /** The Learner's Avatar picture; null until their first pick. */
  avatar: text("avatar", { enum: AVATARS }),
  /** The accent colour behind the Avatar; the app gives a new Learner the least-used one. The default only fills rows from before Avatars. */
  color: text("color", { enum: ACCENT_COLORS }).notNull().default(ACCENT_COLORS[0]),
});

/** The Parent's settings; at most one row (id = 1), and defaults apply until the Parent saves. No API key is ever stored (ADR 0002). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  /** How many times the Tutor may re-explain before the Goal becomes a Flagged Goal. */
  maxReExplanations: integer("max_re_explanations").notNull().default(DEFAULT_TEACHING_SETTINGS.maxReExplanations),
  /** The percentage of a Quiz attempt's answers that must be right for the Goal to be met. */
  passMark: integer("pass_mark").notNull().default(DEFAULT_TEACHING_SETTINGS.passMark),
  /** How many Quiz attempts a Session may have before the Goal becomes a Flagged Goal. */
  maxQuizAttempts: integer("max_quiz_attempts").notNull().default(DEFAULT_TEACHING_SETTINGS.maxQuizAttempts),
  /** The most tokens the Tutor may use in a day; null for no cap. */
  dailyTokenCap: integer("daily_token_cap"),
  /** Minutes into a sitting before the Learner is prompted to take a break. */
  breakMinutes: integer("break_minutes").notNull().default(DEFAULT_LIMIT_SETTINGS.breakMinutes),
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

/** One sitting of a Learner working on a Goal with the Tutor; at most one per Goal is open (not ended) at a time. */
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  /** Where the Session is in the teaching steps; resuming carries on from here. */
  step: text("step", { enum: SESSION_STEPS }).notNull(),
  reExplanations: integer("re_explanations").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});

/** The Session transcript: every Learner and Tutor message, in order. */
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: MESSAGE_ROLES }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** A Lesson Quiz attempt within a Session; at most one per Session is unfinished at a time. */
export const quizAttempts = sqliteTable("quiz_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  /** 1 for the Session's first attempt. */
  number: integer("number").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  /** How many answers were right, and whether that reached the pass mark of the time; set with `finishedAt` once every question is answered. */
  correct: integer("correct"),
  passed: integer("passed", { mode: "boolean" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
});

/** One question of a Quiz attempt, with the Learner's answer and its grading once answered. */
export const quizQuestions = sqliteTable("quiz_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attemptId: integer("attempt_id")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  /** Order within the attempt, from 1. */
  position: integer("position").notNull(),
  type: text("type", { enum: QUESTION_TYPES }).notNull(),
  prompt: text("prompt").notNull(),
  /** The options of a multiple-choice question, as a JSON array; empty for the other types. */
  choices: text("choices", { mode: "json" }).$type<string[]>().notNull(),
  answerKey: text("answer_key").notNull(),
  /** One line on why the answer key is right, shown after a multiple-choice or number answer. */
  explanation: text("explanation").notNull(),
  /** The Learning Objective the question covers, as written in the Curriculum. */
  objective: text("objective").notNull(),
  answer: text("answer"),
  correct: integer("correct", { mode: "boolean" }),
  /** The one-line explanation the Learner saw: the question's own, or the grader's for a short answer. */
  feedback: text("feedback"),
  answeredAt: integer("answered_at", { mode: "timestamp" }),
});
