// PROTOTYPE (throwaway): fake data shaped like src/shared/api.ts. No server, no LLM.
// Math and ELA follow the North Colonie Grade 6 sample; Social Studies and Science are invented so the home screen
// can show every card state at once.
import type { Goal, GoalCard, LearnerProfile, QuizQuestion, QuizScore, SessionMessage } from "../../src/shared/api";

export type AvatarId =
  | "fox" | "owl" | "cat" | "panda" | "frog" | "whale" | "penguin" | "turtle"
  | "rocket" | "planet" | "bolt" | "mountain" | "cactus" | "guitar" | "controller" | "leaf";

export const AVATARS: AvatarId[] = [
  "fox", "owl", "cat", "panda", "frog", "whale", "penguin", "turtle",
  "rocket", "planet", "bolt", "mountain", "cactus", "guitar", "controller", "leaf",
];

export const ACCENTS = ["#ff6b5b", "#ff9f1c", "#f7c948", "#3ecf8e", "#1cb0f6", "#5b6cff", "#a55eea", "#ff5fa2"] as const;

/** A profile as the picker will show it once the schema has an avatar and colour (null until the first pick). */
export type Profile = LearnerProfile & { avatar: AvatarId | null; color: string };

export const profiles: Profile[] = [
  { id: 1, name: "Maya", hasPin: false, avatar: "fox", color: "#ff6b5b" },
  { id: 2, name: "Arjun", hasPin: true, avatar: "rocket", color: "#5b6cff" },
  { id: 3, name: "Leo", hasPin: false, avatar: null, color: "#3ecf8e" },
];

export const me = profiles[0]!;

/** Today, in this prototype. A Tuesday. */
export const today = "2026-10-06";

export const streak = {
  days: 6,
  /** The last seven days, oldest first: worked, rest (a weekend day with no work; never breaks it), or none. */
  week: [
    { label: "W", state: "worked" },
    { label: "T", state: "worked" },
    { label: "F", state: "worked" },
    { label: "S", state: "rest" },
    { label: "S", state: "rest" },
    { label: "M", state: "worked" },
    { label: "T", state: "today" },
  ] as const,
};

export const goalsMet = 11;

/** A Subject on the home screen: its current Goal card (or none while it's with the Parent), and its Term progress. */
export type SubjectCard = {
  key: string;
  name: string;
  card: GoalCard | null;
  withParent: boolean;
  met: number;
  total: number;
  /** "Lesson 3.2" style position, for the card's small print. */
  where: string;
};

export const subjects: SubjectCard[] = [
  {
    key: "math", name: "Math",
    card: { id: 31, kind: "lesson", subjectName: "Math", title: "Dividing a fraction by a fraction", targetDate: "2026-10-02", overdue: true },
    withParent: false, met: 8, total: 16, where: "Unit 3 · Lesson 2",
  },
  {
    key: "ela", name: "ELA",
    card: { id: 14, kind: "lesson", subjectName: "ELA", title: "Point of view", targetDate: "2026-10-09", overdue: false },
    withParent: false, met: 1, total: 17, where: "Unit 1 · Lesson 4",
  },
  {
    key: "social", name: "Social Studies",
    card: { id: 52, kind: "unit-test", subjectName: "Social Studies", title: "Ancient Mesopotamia", targetDate: "2026-10-12", overdue: false },
    withParent: false, met: 4, total: 12, where: "Unit 1 · Unit Test",
  },
  { key: "science", name: "Science", card: null, withParent: true, met: 3, total: 14, where: "Unit 1 · Lesson 4" },
];

export type PathState = "met" | "current" | "skipped" | "with-parent" | "ahead";
export type PathNode = { key: string; kind: "lesson" | "unit-test"; title: string; state: PathState };
export type PathUnit = { key: string; title: string; nodes: PathNode[] };

/** ELA Term 1 as a Learning Path. 1.1 met, 1.2 skipped, 1.4 current (the Parent put it ahead of 1.3), 1.3 ahead. */
export const elaPath: { subject: string; term: string; units: PathUnit[] } = {
  subject: "ELA",
  term: "Term 1",
  units: [
    {
      key: "1", title: "Reading Literature", nodes: [
        { key: "1.1", kind: "lesson", title: "Citing textual evidence", state: "met" },
        { key: "1.2", kind: "lesson", title: "Theme", state: "skipped" },
        { key: "1.3", kind: "lesson", title: "Plot and character", state: "ahead" },
        { key: "1.4", kind: "lesson", title: "Point of view", state: "current" },
        { key: "1", kind: "unit-test", title: "Unit Test: Reading Literature", state: "ahead" },
      ],
    },
    {
      key: "2", title: "Reading Informational Text", nodes: [
        { key: "2.1", kind: "lesson", title: "Central idea", state: "ahead" },
        { key: "2.2", kind: "lesson", title: "Text structure", state: "with-parent" },
        { key: "2.3", kind: "lesson", title: "Author's argument", state: "ahead" },
        { key: "2", kind: "unit-test", title: "Unit Test: Reading Informational Text", state: "ahead" },
      ],
    },
    {
      key: "3", title: "Narrative Writing", nodes: [
        { key: "3.1", kind: "lesson", title: "Planning a narrative", state: "ahead" },
        { key: "3.2", kind: "lesson", title: "Narrative techniques", state: "ahead" },
        { key: "3.3", kind: "lesson", title: "Revising and concluding", state: "ahead" },
        { key: "3", kind: "unit-test", title: "Unit Test: Narrative Writing", state: "ahead" },
      ],
    },
  ],
};

export const session = {
  subjectName: "Math",
  title: "Dividing a fraction by a fraction",
  breakMinutes: 25,
  messages: [
    {
      role: "tutor",
      content:
        "Let's think about \\(\\frac{3}{4} \\div \\frac{1}{8}\\). Dividing asks: how many \\(\\frac{1}{8}\\)s fit inside \\(\\frac{3}{4}\\)? Picture a pizza cut into 8 slices. Three quarters of it is 6 slices, so the answer is 6.",
    },
    { role: "learner", content: "so is it always flip the second one and multiply?" },
  ] satisfies SessionMessage[],
  /** Streamed in word by word. */
  streaming:
    "Yes! Dividing by a fraction is the same as multiplying by its reciprocal: \\(\\frac{3}{4} \\div \\frac{1}{8} = \\frac{3}{4} \\times \\frac{8}{1} = 6\\). " +
    "Quick check on squares while we're here: \\(\\left(\\frac{1}{2}\\right)^2 = \\frac{1}{4}\\), and \\(2^3 = 8\\). " +
    "Your turn: what is \\(\\frac{2}{3} \\div \\frac{1}{6}\\)?",
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1, type: "multiple-choice",
    prompt: "Which is the same as \\(\\frac{2}{5} \\div \\frac{1}{3}\\)?",
    choices: ["\\(\\frac{2}{5} \\times \\frac{3}{1}\\)", "\\(\\frac{5}{2} \\times \\frac{1}{3}\\)", "\\(\\frac{2}{5} \\times \\frac{1}{3}\\)", "\\(\\frac{2}{15}\\)"],
  },
  { id: 2, type: "number", prompt: "How many \\(\\frac{1}{4}\\)-cup scoops are in \\(3\\) cups of flour?", choices: [] },
  {
    id: 3, type: "short-answer",
    prompt: "Explain in your own words why \\(\\frac{1}{2} \\div \\frac{1}{4}\\) is bigger than \\(\\frac{1}{2}\\).",
    choices: [],
  },
];

/** The answers the fake "Tutor" judges, keyed by question id. */
export const quizKey: Record<number, { right: string; shown: string; explanation: string; wrongExplanation: string }> = {
  1: {
    right: "\\(\\frac{2}{5} \\times \\frac{3}{1}\\)",
    shown: "\\(\\frac{2}{5} \\times \\frac{3}{1}\\)",
    explanation: "Dividing by \\(\\frac{1}{3}\\) is the same as multiplying by \\(3\\).",
    wrongExplanation: "Keep the first fraction, flip the second: \\(\\frac{2}{5} \\times \\frac{3}{1}\\).",
  },
  2: {
    right: "12",
    shown: "12",
    explanation: "Each cup holds four \\(\\frac{1}{4}\\)-cup scoops, and \\(3 \\times 4 = 12\\).",
    wrongExplanation: "Each cup holds four scoops, so it's \\(3 \\times 4 = 12\\).",
  },
  3: {
    right: "two",
    shown: "Two quarters fit in a half, so it's \\(2\\)",
    explanation: "Right: two quarters fit in a half, so the answer is \\(2\\).",
    wrongExplanation: "Close! You're counting how many quarters fit inside a half. Two do, so the answer is \\(2\\), bigger than \\(\\frac{1}{2}\\).",
  },
};

export const failedScore: QuizScore = { correct: 1, total: 3, passed: false };
export const missedObjectives = ["Divide by a unit fraction", "Explain why dividing by a fraction less than 1 makes a bigger number"];

export const nextUp: GoalCard = { id: 32, kind: "lesson", subjectName: "Math", title: "Word problems with fraction division", targetDate: "2026-10-09", overdue: false };

/** Maya's goals as the Parent sees them, in queue order per Subject. */
export const parentGoals: Goal[] = [
  { id: 29, subjectKey: "math", subjectName: "Math", lessonKey: "2.3", kind: "lesson", title: "Percents", targetDate: "2026-09-25", status: "met", overdue: false, orphaned: false },
  { id: 30, subjectKey: "math", subjectName: "Math", lessonKey: "3.1", kind: "lesson", title: "Meanings of division", targetDate: "2026-09-30", status: "met", overdue: false, orphaned: false },
  { id: 31, subjectKey: "math", subjectName: "Math", lessonKey: "3.2", kind: "lesson", title: "Dividing a fraction by a fraction", targetDate: "2026-10-02", status: "active", overdue: true, orphaned: false },
  { id: 32, subjectKey: "math", subjectName: "Math", lessonKey: "3.3", kind: "lesson", title: "Word problems with fraction division", targetDate: "2026-10-09", status: "active", overdue: false, orphaned: false },
  { id: 33, subjectKey: "math", subjectName: "Math", lessonKey: "3", kind: "unit-test", title: "Dividing Fractions", targetDate: "2026-10-14", status: "active", overdue: false, orphaned: false },
  { id: 11, subjectKey: "ela", subjectName: "ELA", lessonKey: "1.1", kind: "lesson", title: "Citing textual evidence", targetDate: "2026-09-22", status: "met", overdue: false, orphaned: false },
  { id: 12, subjectKey: "ela", subjectName: "ELA", lessonKey: "1.2", kind: "lesson", title: "Theme", targetDate: "2026-09-29", status: "skipped", overdue: false, orphaned: false },
  { id: 14, subjectKey: "ela", subjectName: "ELA", lessonKey: "1.4", kind: "lesson", title: "Point of view", targetDate: "2026-10-09", status: "active", overdue: false, orphaned: false },
  { id: 13, subjectKey: "ela", subjectName: "ELA", lessonKey: "1.3", kind: "lesson", title: "Plot and character", targetDate: "2026-10-13", status: "active", overdue: false, orphaned: false },
  { id: 41, subjectKey: "science", subjectName: "Science", lessonKey: "1.4", kind: "lesson", title: "Density", targetDate: "2026-10-01", status: "flagged", overdue: true, orphaned: false },
  { id: 42, subjectKey: "science", subjectName: "Science", lessonKey: "1.5", kind: "lesson", title: "States of matter", targetDate: "2026-10-08", status: "active", overdue: false, orphaned: false },
];

export const parentLearners = [
  { ...profiles[0]!, grade: "6", streak: 6, met: 11, overdue: 1, flagged: 1 },
  { ...profiles[1]!, grade: "8", streak: 0, met: 23, overdue: 0, flagged: 0 },
  { ...profiles[2]!, grade: "4", streak: 2, met: 3, overdue: 2, flagged: 0 },
];

export function shortDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function groupBy<T>(xs: T[], key: (x: T) => string) {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}
