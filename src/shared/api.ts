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

export type GoalKind = "lesson" | "unit-test";
export type GoalStatus = "active" | "met" | "flagged" | "skipped";

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
