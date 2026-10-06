/**
 * The Lesson Quiz: questions generated fresh for each attempt, answers graded (by the app where it can, by the LLM for written ones),
 * and what an attempt's score leads to: the Goal met, re-teaching then another attempt, or a Flagged Goal.
 */

import { LlmError, type JsonSchema } from "../llm/provider";
import { QUESTION_TYPES, type QuestionType, type TeachingSettings } from "../shared/api";
import { GUARDRAILS, bullets, lessonContext, type TutorLesson, type TutorLlm } from "./lesson";

/** A question as generated: the Learner never sees the answer key or explanation until they've answered. */
export type GeneratedQuestion = {
  type: QuestionType;
  prompt: string;
  /** The options of a multiple-choice question, the answer key among them; empty for the other types. */
  choices: string[];
  answerKey: string;
  /** One line on why the answer key is right. */
  explanation: string;
  /** The Learning Objective it covers, exactly as the Curriculum writes it. */
  objective: string;
};

export const QUIZ_LENGTH = { min: 10, max: 20 };

/** Five questions per Learning Objective, kept within 10–20. */
export function quizLength(learningObjectives: number): number {
  return Math.min(QUIZ_LENGTH.max, Math.max(QUIZ_LENGTH.min, 5 * learningObjectives));
}

/**
 * Generates a new attempt's questions through structured output. Questions that don't hold together (a multiple-choice
 * answer key that isn't a choice, a number answer that isn't a number, an unknown Learning Objective) and any repeat of
 * `earlierPrompts`, the Session's earlier attempts, are dropped. Throws LlmError when fewer than 10 are left, or they leave
 * a Learning Objective untested (for a Unit Test with more Learning Objectives than questions: unless every question tests
 * a different one).
 */
export async function generateQuiz(llm: TutorLlm, lesson: TutorLesson, grade: string, earlierPrompts: string[]): Promise<GeneratedQuestion[]> {
  const length = quizLength(lesson.learningObjectives.length);
  const earlier = earlierPrompts.length === 0 ? "" : `\n\nThe Learner has already seen these questions. Write completely new ones, not rewordings of them:\n${bullets(earlierPrompts)}`;
  const coverage =
    lesson.learningObjectives.length <= length
      ? "together cover every Learning Objective, about evenly"
      : "each test a different Learning Objective, picked from across the whole list";
  const system = `You write quizzes for a child's tutoring Lesson.\n\n${lessonContext(lesson, grade)}\n\n${GUARDRAILS}

Write a quiz of exactly ${length} questions that ${coverage}. Mix the question types:
- "multiple-choice": 3 or 4 choices, exactly one right; "answer" is the right choice, written exactly as in "choices".
- "number": the answer is a single number, written as digits (a whole number, decimal or fraction like 3/4); "choices" is empty.
- "short-answer": the Learner writes a word, phrase or sentence; "answer" is a model answer; "choices" is empty.
Each question's "explanation" is one short sentence, for the Learner, on why the answer is right.
Each question's "objective" is the Learning Objective it tests, copied exactly.${earlier}`;
  const { data } = await llm.structured({ system, messages: [{ role: "user", content: "Write the quiz." }], schema: quizSchema(lesson) });

  const generated = (data as { questions?: unknown } | null)?.questions;
  const seen = new Set(earlierPrompts.map(normalize));
  const questions: GeneratedQuestion[] = [];
  for (const raw of Array.isArray(generated) ? generated : []) {
    const question = validQuestion(raw, lesson);
    if (!question || seen.has(normalize(question.prompt))) continue;
    seen.add(normalize(question.prompt));
    questions.push(question);
  }
  if (questions.length < QUIZ_LENGTH.min) throw new LlmError("failed", `The generated quiz had only ${questions.length} usable new questions.`);
  const quiz = questions.slice(0, length);
  if (new Set(quiz.map((q) => q.objective)).size < Math.min(length, lesson.learningObjectives.length)) {
    throw new LlmError("failed", "The generated quiz left a Learning Objective untested.");
  }
  return quiz;
}

function quizSchema(lesson: TutorLesson): JsonSchema {
  return {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...QUESTION_TYPES] },
            prompt: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            explanation: { type: "string" },
            objective: { type: "string", enum: lesson.learningObjectives },
          },
          required: ["type", "prompt", "choices", "answer", "explanation", "objective"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  };
}

/** A generated question as the app keeps it, or undefined when it doesn't hold together. */
function validQuestion(raw: unknown, lesson: TutorLesson): GeneratedQuestion | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { type, prompt, choices, answer, explanation, objective } = raw as Record<string, unknown>;
  if (!QUESTION_TYPES.includes(type as QuestionType)) return undefined;
  if (typeof prompt !== "string" || prompt.trim() === "" || typeof answer !== "string" || answer.trim() === "") return undefined;
  if (typeof explanation !== "string" || typeof objective !== "string" || !lesson.learningObjectives.includes(objective)) return undefined;
  const question = { type: type as QuestionType, prompt: prompt.trim(), answerKey: answer.trim(), explanation: explanation.trim(), objective };
  if (type !== "multiple-choice") {
    if (type === "number" && parseNumber(answer) === undefined) return undefined;
    return { ...question, choices: [] };
  }
  if (!Array.isArray(choices) || !choices.every((c) => typeof c === "string" && c.trim() !== "")) return undefined;
  const options = (choices as string[]).map((c) => c.trim());
  if (options.length < 2 || new Set(options.map(normalize)).size !== options.length) return undefined;
  const key = options.find((c) => normalize(c) === normalize(answer));
  return key === undefined ? undefined : { ...question, choices: options, answerKey: key };
}

/** Whether `answer` can be graded for `question`: a multiple-choice answer must be one of its choices, a number answer a number. */
export function checkAnswer(question: Pick<GeneratedQuestion, "type" | "choices">, answer: string): "ok" | "invalidAnswer" {
  if (question.type === "multiple-choice") return question.choices.some((c) => normalize(c) === normalize(answer)) ? "ok" : "invalidAnswer";
  if (question.type === "number") return parseNumber(answer) === undefined ? "invalidAnswer" : "ok";
  return "ok";
}

/** Whether the answer is right, with a one-line explanation for the Learner. */
export type Grade = { correct: boolean; explanation: string };

/**
 * Grades an answer that passed `checkAnswer`. Multiple-choice and number answers are graded here, without the LLM;
 * a short answer is graded by the LLM through structured output, which throws LlmError when the call fails.
 */
export async function gradeAnswer(llm: TutorLlm, lesson: TutorLesson, grade: string, question: GeneratedQuestion, answer: string): Promise<Grade> {
  if (question.type === "multiple-choice") return { correct: normalize(answer) === normalize(question.answerKey), explanation: question.explanation };
  if (question.type === "number") return { correct: sameNumber(parseNumber(answer), parseNumber(question.answerKey)), explanation: question.explanation };

  const system = `You grade a child's written answer to one quiz question in a tutoring Lesson.\n\n${lessonContext(lesson, grade)}

The question tests this Learning Objective: ${question.objective}
Question: ${question.prompt}
Model answer: ${question.answerKey}

The Learner's answer is their message. Mark it correct if it shows the same understanding as the model answer, even in different words or with small spelling mistakes; otherwise mark it wrong.
"explanation" is one short, kind sentence to the Learner saying why it's right, or what the right answer is and why. Use LaTeX between \\( and \\) for any maths.`;
  const { data } = await llm.structured({ system, messages: [{ role: "user", content: answer }], schema: GRADE_SCHEMA });
  const { correct, explanation } = (data ?? {}) as Record<string, unknown>;
  if (typeof correct !== "boolean" || typeof explanation !== "string") throw new LlmError("failed", "The short-answer grade was not in the expected shape.");
  return { correct, explanation: explanation.trim() };
}

const GRADE_SCHEMA: JsonSchema = {
  type: "object",
  properties: { correct: { type: "boolean" }, explanation: { type: "string" } },
  required: ["correct", "explanation"],
  additionalProperties: false,
};

/** What a finished attempt leads to: the Goal met, re-teaching then another attempt, or (past the attempt cap) a Flagged Goal. */
export type AttemptOutcome = { passed: true; step: "goal-met" } | { passed: false; step: "re-teaching" | "ended" };

/** The attempt numbered `attempt` (from 1) scored `correct` out of `total`. */
export function afterAttempt(
  { correct, total, attempt }: { correct: number; total: number; attempt: number },
  { passMark, maxQuizAttempts }: Pick<TeachingSettings, "passMark" | "maxQuizAttempts">,
): AttemptOutcome {
  if (correct * 100 >= passMark * total) return { passed: true, step: "goal-met" };
  return { passed: false, step: attempt >= maxQuizAttempts ? "ended" : "re-teaching" };
}

/** The Learning Objectives of the answers that were wrong, in Curriculum order, each once. */
export function missedObjectives(lesson: TutorLesson, answers: { objective: string; correct: boolean | null }[]): string[] {
  return lesson.learningObjectives.filter((objective) => answers.some((a) => a.objective === objective && a.correct === false));
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** A number as a Learner might write it: whole, decimal, with thousands commas, a fraction, or a mixed number. */
export function parseNumber(text: string): number | undefined {
  const s = text.trim().replace(/\s+/g, " ");
  const sign = s.startsWith("-") ? -1 : 1;
  const unsigned = s.replace(/^-\s?/, "");
  if (/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^\.\d+$/.test(unsigned)) return sign * Number(unsigned.replace(/,/g, ""));
  const fraction = /^(?:(\d+) )?(\d+) ?\/ ?(\d+)$/.exec(unsigned);
  if (!fraction || Number(fraction[3]) === 0) return undefined;
  return sign * (Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]));
}

function sameNumber(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}
