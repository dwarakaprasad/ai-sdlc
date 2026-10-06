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

/** The pictures a Learner can pick as their Avatar (see CONTEXT.md); the app ships a drawing for each. */
export const AVATARS = [
  "fox",
  "owl",
  "cat",
  "panda",
  "frog",
  "whale",
  "penguin",
  "turtle",
  "rocket",
  "planet",
  "bolt",
  "mountain",
  "cactus",
  "guitar",
  "controller",
  "leaf",
] as const;
export type AvatarId = (typeof AVATARS)[number];

/** The accent colours a Learner's Avatar sits on, in palette order: each new Learner gets the one after the last Learner's. */
export const ACCENT_COLORS = ["coral", "amber", "sun", "mint", "sky", "indigo", "violet", "pink"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

/** A Learner's Avatar and its colour; no picture until the Learner's first pick. */
export type AvatarChoice = { avatar: AvatarId | null; color: AccentColor };

/** A Learner as the Parent sees it (GET /api/parent/learners). The PIN itself is never returned. */
export type Learner = { id: number; name: string; grade: string; curriculumId: string; hasPin: boolean } & AvatarChoice;

/**
 * Body of POST /api/parent/learners and PUT /api/parent/learners/:id. On edit, an absent `pin` keeps it and `null` removes it;
 * an absent `avatar` or `color` keeps it (a new Learner gets no Avatar and the next colour), and a `null` Avatar clears it.
 */
export type LearnerInput = { name: string; grade: string; curriculumId: string; pin?: string | null } & Partial<AvatarChoice>;

/** One profile on the Learner login screen (GET /api/learner/profiles). */
export type LearnerProfile = { id: number; name: string; hasPin: boolean } & AvatarChoice;

/** The logged-in Learner (GET /api/learner/me, and PUT /api/learner/me/avatar, whose body is `{ avatar, color }`, both required). */
export type LoggedInLearner = { id: number; name: string } & AvatarChoice;

export const isAvatarId = (value: unknown): value is AvatarId => AVATARS.includes(value as AvatarId);
export const isAccentColor = (value: unknown): value is AccentColor => ACCENT_COLORS.includes(value as AccentColor);

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
 * `lessonKey` is the Unit key for a unit-test Goal. `overdue` and `orphaned` are worked out on each request.
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
  /**
   * Its Lesson (or Unit) is gone from the Learner's Curriculum, say after a renumbering, so its title falls back to its key.
   * The Parent re-points or removes it; until then its Subject shows the Learner no card. Never set while the Curriculum is invalid.
   */
  orphaned: boolean;
};

/** One Session in the progress view: when it ran, where it got to, and the score of each finished Quiz attempt. Times are ISO 8601. */
export type SessionSummary = {
  id: number;
  startedAt: string;
  /** Null while the Session is open. */
  endedAt: string | null;
  step: SessionStep;
  attempts: ({ number: number } & QuizScore)[];
};

/** One Goal in the progress view (GET /api/parent/learners/:id/progress): the Goal, with its Sessions oldest first. */
export type GoalProgress = Goal & { sessions: SessionSummary[] };

/** A Quiz question as the Parent reads it in a transcript: with its answer key, and the Learner's answer once given. */
export type TranscriptQuestion = {
  type: QuestionType;
  prompt: string;
  choices: string[];
  objective: string;
  answerKey: string;
  answer: string | null;
  correct: boolean | null;
  /** The one-line explanation the Learner saw after answering. */
  feedback: string | null;
};

/**
 * A Session transcript as the Parent reads it (GET /api/parent/learners/:id/sessions/:sessionId): every message with when it
 * was sent, and every Quiz attempt with its questions and answers, and its score once finished.
 */
export type SessionTranscript = Omit<SessionSummary, "attempts"> & {
  goalId: number;
  kind: GoalKind;
  subjectName: string;
  title: string;
  messages: (SessionMessage & { at: string })[];
  attempts: { number: number; questions: TranscriptQuestion[]; score?: QuizScore }[];
};

/** Body of POST /api/parent/learners/:id/goals/:goalId/repoint: the Lesson (or for a Unit Test, the Unit) an orphaned Goal now targets. */
export type RepointInput = { lessonKey: string };

/** A Lesson a Goal can be set from (GET /api/parent/learners/:id/lessons), in Curriculum order, with the Term it belongs to. */
export type LessonOption = { key: string; subjectKey: string; subjectName: string; termKey: string; termName: string; unitTitle: string; title: string };

/**
 * Body of POST /api/parent/learners/:id/goals. The new Goal joins the end of its Subject's queue,
 * or is inserted just before `beforeGoalId`, a Goal of the same Subject.
 */
export type GoalInput = { lessonKey: string; targetDate: string; beforeGoalId?: number };

/**
 * Body of POST /api/parent/learners/:id/goals/spread, which answers with all the Learner's Goals.
 * Spreads Target Dates evenly from today to `termEndDate` over the Term's Lessons still to be met, creating Goals for
 * Lessons that have none. `termEndDate` is YYYY-MM-DD, today or later.
 */
export type SpreadInput = { termKey: string; termEndDate: string };

/** Body of PUT /api/parent/learners/:id/goals/order: one Subject's whole queue, every Goal once, in its new order. */
export type GoalOrder = { goalIds: number[] };

/** One Goal card on the Learner home screen (GET /api/learner/goals): a Subject's current Goal. A Unit Test's title is its Unit's. */
export type GoalCard = Pick<Goal, "id" | "kind" | "subjectName" | "title" | "targetDate" | "overdue">;

/**
 * Where a Session is in the teaching steps: hearing the Explanation, talking through the Understanding Check,
 * waiting to start a Lesson Quiz attempt, answering one, hearing the missed Learning Objectives re-taught after a failed attempt,
 * the Goal met, or ended (its Goal became a Flagged Goal). The last two end the Session.
 */
export const SESSION_STEPS = ["explanation", "understanding-check", "ready-for-quiz", "quiz", "re-teaching", "goal-met", "ended"] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];

/** Steps whose turn the Tutor starts on its own, without a message from the Learner. */
export const TUTOR_STARTED_STEPS: readonly SessionStep[] = ["explanation", "re-teaching"];

/** Steps that end the Session: its Goal is met, or became a Flagged Goal. */
export const ENDING_STEPS: readonly SessionStep[] = ["goal-met", "ended"];
export const MESSAGE_ROLES = ["learner", "tutor"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** One message of a Session transcript. */
export type SessionMessage = { role: MessageRole; content: string };

export const QUESTION_TYPES = ["multiple-choice", "number", "short-answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Right or wrong, with a one-line explanation and the answer key, shown straight after an answer; and the Learning Objective
 * the question tested, so a failed attempt's score can name what was missed.
 */
export type AnswerFeedback = { correct: boolean; explanation: string; correctAnswer: string; objective: string };

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
 * A Unit Test's Session is titled with its Unit, and starts at "ready-for-quiz": it has no Explanation or Understanding Check.
 */
export type TutorSession = {
  id: number;
  kind: GoalKind;
  subjectName: string;
  title: string;
  /** What the Lesson (or every Lesson of a Unit Test's Unit) teaches, for the Learner to see beside the conversation. */
  learningObjectives: string[];
  step: SessionStep;
  messages: SessionMessage[];
  quiz?: QuizAttempt;
  /** Minutes into a sitting before the Learner is prompted to take a break. */
  breakMinutes: number;
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

/**
 * GET and PUT /api/parent/settings/limits (a PUT may send only the settings it changes).
 * `dailyTokenCap` is the most tokens (in and out) the Tutor may use in a day, or null for no cap. Once a day's usage reaches it,
 * Learner calls that need the LLM answer 429 `{ error: "dailyLimitReached" }` until the next day.
 */
export type LimitSettings = { dailyTokenCap: number | null; breakMinutes: number };

export const DEFAULT_LIMIT_SETTINGS: LimitSettings = { dailyTokenCap: null, breakMinutes: 25 };

/** The longest break-prompt time the Parent can set, in minutes. */
export const MAX_BREAK_MINUTES = 240;
