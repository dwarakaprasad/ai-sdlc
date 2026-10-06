// PROTOTYPE (throwaway): screen ids, the fake streaming reply, and a fake Quiz judge shared by the three directions.
import { useEffect, useState } from "react";
import type { AnswerFeedback } from "../../../src/shared/api";
import { failedScore, quizKey, quizQuestions, session } from "../data";

export const SCREENS = [
  ["profiles", "1 Profile picker"],
  ["avatar", "2 Avatar pick"],
  ["home", "3 Home"],
  ["path", "4 Learning Path"],
  ["chat", "5 Session chat"],
  ["quiz", "6a Quiz: choose"],
  ["quiz-right", "6b Quiz: right"],
  ["quiz-wrong", "6c Quiz: not quite"],
  ["quiz-score", "6d Quiz: score"],
  ["goal-met", "7 Goal met"],
  ["parent", "8 Parent: Goals"],
] as const;
export type ScreenId = (typeof SCREENS)[number][0];

export type VariantProps = { screen: ScreenId; tutorName: string; go: (s: ScreenId) => void };

/** The Tutor's reply, word by word, then the break prompt. */
export function useStream() {
  const words = session.streaming.split(" ");
  const [n, setN] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN((k) => (k >= words.length ? (clearInterval(t), k) : k + 1)), 70);
    return () => clearInterval(t);
  }, [run]);
  return { text: words.slice(0, n).join(" "), done: n >= words.length, replay: () => setRun((r) => r + 1) };
}

function judge(id: number, answer: string): AnswerFeedback {
  const key = quizKey[id]!;
  const a = answer.trim().toLowerCase();
  const correct = id === 3 ? /\b(two|2)\b/.test(a) : a === key.right.toLowerCase();
  return { correct, explanation: correct ? key.explanation : key.wrongExplanation, correctAnswer: key.shown };
}

export type Quiz = ReturnType<typeof useQuiz>;

/** One Lesson Quiz attempt, started at the state its screen shows. */
export function useQuiz(screen: ScreenId) {
  type State = { index: number; draft: string; feedback: AnswerFeedback | null; results: boolean[] };
  const wrong = "Because a quarter is smaller so the answer gets smaller";
  const presets: Record<string, State> = {
    quiz: { index: 0, draft: "", feedback: null, results: [] },
    "quiz-right": { index: 1, draft: "12", feedback: judge(2, "12"), results: [false] },
    "quiz-wrong": { index: 2, draft: wrong, feedback: judge(3, wrong), results: [false, true] },
    "quiz-score": { index: 3, draft: "", feedback: null, results: [false, true, false] },
  };
  const preset = presets[screen] ?? presets.quiz!;
  const [s, setS] = useState<State>(preset);
  useEffect(() => setS(preset), [screen]);
  const question = quizQuestions[s.index];
  const total = quizQuestions.length;
  const done = s.index >= total;
  const correct = s.results.filter(Boolean).length + (s.feedback?.correct ? 1 : 0);
  return {
    ...s, question, total, done,
    score: done ? { ...failedScore, correct: s.results.filter(Boolean).length, passed: s.results.every(Boolean) } : undefined,
    correctSoFar: correct,
    setDraft: (draft: string) => setS((x) => (x.feedback ? x : { ...x, draft })),
    check: () => setS((x) => (x.draft.trim() ? { ...x, feedback: judge(quizQuestions[x.index]!.id, x.draft) } : x)),
    next: () => setS((x) => ({ index: x.index + 1, draft: "", feedback: null, results: [...x.results, !!x.feedback?.correct] })),
    retry: () => setS({ index: 0, draft: "", feedback: null, results: [] }),
  };
}

export function daysLate(target: string, today: string) {
  return Math.round((Date.parse(today) - Date.parse(target)) / 86400000);
}
