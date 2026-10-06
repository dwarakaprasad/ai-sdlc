import type { Curriculum, CurriculumError } from "../curriculum/types";
import type { LlmErrorKind, ProviderId } from "./llm";

/** Response of GET /api/parent/status. */
export type ParentStatus = { passwordSet: boolean; loggedIn: boolean };

/** One entry of GET /api/parent/curricula: a Curriculum folder, valid or with its validation errors. */
export type CurriculumSummary =
  | (Pick<Curriculum, "id" | "title" | "district" | "grade" | "schoolYear"> & {
      valid: true;
      subjects: { key: string; name: string; lessonCount: number }[];
    })
  | { id: string; valid: false; errors: CurriculumError[] };

/** A Learner as the Parent sees it (GET /api/parent/learners). The PIN itself is never returned. */
export type Learner = { id: number; name: string; grade: string; curriculumId: string; hasPin: boolean };

/** Body of POST /api/parent/learners and PUT /api/parent/learners/:id. On edit, an absent `pin` keeps it and `null` removes it. */
export type LearnerInput = { name: string; grade: string; curriculumId: string; pin?: string | null };

/** One profile on the Learner login screen (GET /api/learner/profiles). */
export type LearnerProfile = { id: number; name: string; hasPin: boolean };

/** The logged-in Learner (GET /api/learner/me). */
export type LoggedInLearner = { id: number; name: string };

/** GET and PUT /api/parent/settings/llm: which provider and model the Tutor uses. The API key is never part of it. */
export type LlmSettings = { provider: ProviderId; model: string };

/** Response of POST /api/parent/settings/llm/test: whether a call with the current settings worked, and if not, why. */
export type ConnectionTest = { ok: true } | { ok: false; error: LlmErrorKind; envVar: string; model: string };

/** One day of GET /api/parent/usage (most recent day first). */
export type DailyUsage = { date: string; calls: number; inputTokens: number; outputTokens: number };

export const GOAL_KINDS = ["lesson", "unit-test"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_STATUSES = ["active", "met", "flagged", "skipped"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/**
 * A Goal as the Parent sees it (GET /api/parent/learners/:id/goals), in queue order per Subject.
 * `lessonKey` is the Unit key for a unit-test Goal. `overdue` is worked out on each request.
 */
export type Goal = {
  id: number;
  subjectKey: string;
  subjectName: string;
  lessonKey: string;
  kind: GoalKind;
  title: string;
  /** YYYY-MM-DD. */
  targetDate: string;
  status: GoalStatus;
  overdue: boolean;
};

/** A Lesson a Goal can be set from (GET /api/parent/learners/:id/lessons), in Curriculum order. */
export type LessonOption = { key: string; subjectName: string; unitTitle: string; title: string };

/** Body of POST /api/parent/learners/:id/goals. */
export type GoalInput = { lessonKey: string; targetDate: string };

/** One Goal card on the Learner home screen (GET /api/learner/goals): a Subject's current Goal. */
export type GoalCard = Pick<Goal, "id" | "subjectName" | "title" | "targetDate" | "overdue">;

/**
 * Where a Session is in the teaching steps: hearing the Explanation, talking through the Understanding Check,
 * waiting for the Lesson Quiz, or ended (its Goal became a Flagged Goal).
 */
export const SESSION_STEPS = ["explanation", "understanding-check", "ready-for-quiz", "ended"] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];
export const MESSAGE_ROLES = ["learner", "tutor"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** One message of a Session transcript. */
export type SessionMessage = { role: MessageRole; content: string };

/** A Session as the Learner sees it (POST /api/learner/goals/:id/session): the transcript so far and the current step. */
export type TutorSession = { id: number; subjectName: string; title: string; step: SessionStep; messages: SessionMessage[] };

/** Body of POST /api/learner/sessions/:id/turn; `message` is absent for the turn that gives the Explanation. */
export type TurnInput = { message?: string };

/**
 * The Server-Sent Events of POST /api/learner/sessions/:id/turn: `text` pieces of the Tutor's reply as it's generated,
 * then either `done` with the Session's next step, or `error`, in which case nothing from the turn is kept.
 * After `llmFailed` the turn can be tried again; after `sessionChanged` another turn moved the Session on first, so reopen it.
 */
export type TurnEvents = { text: { text: string }; done: { step: SessionStep }; error: { error: "llmFailed" | "sessionChanged" } };

/** GET and PUT /api/parent/settings/teaching. */
export type TeachingSettings = { maxReExplanations: number };

export const DEFAULT_TEACHING_SETTINGS: TeachingSettings = { maxReExplanations: 3 };

/** The largest re-explanation cap the Parent can set. */
export const MAX_RE_EXPLANATIONS_LIMIT = 10;
