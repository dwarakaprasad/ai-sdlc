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
 * waiting to start a Lesson Quiz attempt, answering one, hearing the missed Learning Objectives re-taught after a failed attempt,
 * the Goal met, or ended (its Goal became a Flagged Goal). The last two end the Session.
 */
export const SESSION_STEPS = ["explanation", "understanding-check", "ready-for-quiz", "quiz", "remediation", "goal-met", "ended"] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];
export const MESSAGE_ROLES = ["learner", "tutor"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** One message of a Session transcript. */
export type SessionMessage = { role: MessageRole; content: string };

export const QUESTION_TYPES = ["multiple-choice", "number", "short-answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Right or wrong, with a one-line explanation and the answer key, shown straight after an answer. */
export type AnswerFeedback = { correct: boolean; explanation: string; correctAnswer: string };

/** A Quiz question as the Learner sees it. The answer key is only part of the feedback, once it's answered. */
export type QuizQuestion = {
  id: number;
  type: QuestionType;
  prompt: string;
  /** The options of a multiple-choice question; empty for the other types. */
  choices: string[];
  answered?: { answer: string } & AnswerFeedback;
};

/** How many answers in an attempt were right, out of its questions, and whether that reaches the pass mark. */
export type QuizScore = { correct: number; total: number; passed: boolean };

/** A Lesson Quiz attempt: its questions in order, and its score once every question is answered. */
export type QuizAttempt = { number: number; maxAttempts: number; questions: QuizQuestion[]; score?: QuizScore };

/**
 * A Session as the Learner sees it (POST /api/learner/goals/:id/session): the transcript so far, the current step,
 * and the Session's latest Quiz attempt, if it has one (in progress, or finished with its score).
 */
export type TutorSession = {
  id: number;
  subjectName: string;
  title: string;
  step: SessionStep;
  messages: SessionMessage[];
  quiz?: QuizAttempt;
};

/**
 * Response of POST /api/learner/sessions/:id/answer, whose body is `{ questionId, answer }`:
 * the feedback on that answer, the Session's next step, and the attempt's score when that was its last question.
 */
export type AnswerResult = { feedback: AnswerFeedback; step: SessionStep; score?: QuizScore };

/**
 * The Server-Sent Events of POST /api/learner/sessions/:id/turn, whose body is `{ message }`
 * (no message for the turns the Tutor starts: the Explanation, and the re-teaching after a failed Quiz attempt): `text` pieces of the Tutor's reply as it's generated,
 * then either `done` with the Session's next step, or `error`, in which case nothing from the turn is kept.
 * After `llmFailed` the turn can be tried again; after `sessionChanged` another turn moved the Session on first, so reopen it.
 */
export type TurnEvents = { text: { text: string }; done: { step: SessionStep }; error: { error: "llmFailed" | "sessionChanged" } };

/**
 * GET and PUT /api/parent/settings/teaching (a PUT may send only the settings it changes).
 * `passMark` is the percentage of a Quiz attempt's answers that must be right for the Goal to be met.
 */
export type TeachingSettings = { maxReExplanations: number; passMark: number; maxQuizAttempts: number };

export const DEFAULT_TEACHING_SETTINGS: TeachingSettings = { maxReExplanations: 3, passMark: 100, maxQuizAttempts: 3 };

/** The largest re-explanation cap the Parent can set. */
export const MAX_RE_EXPLANATIONS_LIMIT = 10;

/** The largest Quiz attempt cap the Parent can set; at least one attempt is always allowed. */
export const MAX_QUIZ_ATTEMPTS_LIMIT = 10;
