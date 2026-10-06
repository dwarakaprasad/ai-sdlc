/** What every part of the Tutor shares: the Lesson being taught, the LLM it teaches through, and the instructions every call carries. */

import type { ChatEvent, ChatMessage, JsonSchema, StructuredResult } from "../llm/provider";

/** The Lesson being taught, with what the Curriculum says about how to teach its Subject. */
export type TutorLesson = {
  subjectName: string;
  title: string;
  learningObjectives: string[];
  tutoringInstructions: string | undefined;
};

/** The LLM as the Tutor needs it; the app's usage-recording LLM fits. */
export interface TutorLlm {
  chat(call: { system: string; messages: ChatMessage[] }): AsyncIterable<ChatEvent>;
  structured(call: { system: string; messages: ChatMessage[]; schema: JsonSchema }): Promise<StructuredResult>;
}

/** What every Tutor instruction carries: the Lesson, its Learning Objectives, the Tutoring Instructions, the grade and the guardrails. */
export function lessonContext(lesson: TutorLesson, grade: string): string {
  const parts = [
    `The Learner is in grade ${grade}. The Lesson is "${lesson.title}" in ${lesson.subjectName}.`,
    `Learning Objectives (what the Learner must be able to do):\n${bullets(lesson.learningObjectives)}`,
  ];
  if (lesson.tutoringInstructions) {
    parts.push(`Tutoring Instructions for ${lesson.subjectName} (always teach this way):\n${lesson.tutoringInstructions}`);
  }
  return parts.join("\n\n");
}

/** Lines as a markdown bulleted list, for instructions to the LLM. */
export function bullets(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

/** Always part of the Tutor's instructions: on-Lesson, age-appropriate, and never asking for personal information. */
export const GUARDRAILS = `Rules you always follow:
- Stay on this Lesson. If the Learner talks about something else, kindly steer them back to it.
- Use warm, simple, age-appropriate language for the Learner's grade.
- Never ask for personal information (such as their full name, address, school, age, contact details or photos), and don't encourage them to share any.
- Keep replies short: a few short paragraphs at most.
- Write maths in LaTeX between \\( and \\) inline, or \\[ and \\] on its own line. Never use $ signs around maths.`;
