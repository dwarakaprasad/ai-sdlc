/**
 * The Tutor: the teaching steps of a Session, as a state machine driven by the LLM.
 * A Session's state, the Lesson, the Learner's grade, the transcript and the Learner's latest message go in;
 * a streamed Tutor reply and the Session's next state come out. The Lesson Quiz is in ./quiz.
 * It knows nothing of HTTP or the database.
 */

import { LlmError, type ChatEvent, type ChatMessage, type JsonSchema } from "../llm/provider";
import type { SessionMessage, SessionStep } from "../shared/api";
import { GUARDRAILS, bullets, lessonContext, type TutorLesson, type TutorLlm } from "./lesson";

export { GUARDRAILS, type TutorLesson, type TutorLlm } from "./lesson";
export * from "./quiz";

/** The part of a Session the Tutor reads and moves on. */
export type TutorState = { step: SessionStep; reExplanations: number };

export const START_STATE: TutorState = { step: "explanation", reExplanations: 0 };

export type TutorTurnInput = {
  state: TutorState;
  lesson: TutorLesson;
  grade: string;
  /** The Session's messages so far, oldest first. */
  transcript: SessionMessage[];
  /** Absent for the turns the Tutor starts: the Explanation and the re-teaching after a failed Quiz attempt. */
  learnerMessage: string | undefined;
  /** Re-explanations allowed before the Goal becomes a Flagged Goal. */
  maxReExplanations: number;
  /** The Learning Objectives the last Quiz attempt got wrong, which the re-teaching covers; empty before any attempt. */
  missedObjectives: string[];
};

/** How a turn ended: the Session's next state, and whether its Goal is now a Flagged Goal. */
export type TurnOutcome = { state: TutorState; flagged: boolean };

/**
 * Whether a turn can be taken now, before any LLM call: the Explanation and the re-teaching need no message,
 * the Understanding Check needs one, and a Session at any other step takes no turns.
 */
export function checkTurn(state: TutorState, learnerMessage: string | undefined): "ok" | "messageRequired" | "noTurnNow" {
  if (state.step === "explanation" || state.step === "remediation") return "ok";
  if (state.step !== "understanding-check") return "noTurnNow";
  return learnerMessage === undefined ? "messageRequired" : "ok";
}

/**
 * Takes one turn: yields the Tutor's reply as it's generated, and returns the outcome once it's complete.
 * Throws LlmError when a call fails; the caller then keeps nothing from the turn. Call `checkTurn` first.
 */
export async function* tutorTurn(input: TutorTurnInput, llm: TutorLlm): AsyncGenerator<string, TurnOutcome> {
  const { state, lesson, grade, maxReExplanations } = input;
  const messages = conversation(input);
  const reply = (task: string) => streamText(llm.chat({ system: systemPrompt(lesson, grade, task), messages }));

  if (state.step === "explanation") {
    yield* reply(TASKS.explain);
    return { state: { step: "understanding-check", reExplanations: 0 }, flagged: false };
  }
  if (state.step === "remediation") {
    yield* reply(TASKS.reTeach(input.missedObjectives));
    return { state: { ...state, step: "ready-for-quiz" }, flagged: false };
  }

  const verdict = await understandingVerdict(llm, lesson, grade, messages);
  if (verdict === "advance") {
    yield* reply(TASKS.advance);
    return { state: { ...state, step: "ready-for-quiz" }, flagged: false };
  }
  if (verdict === "continue") {
    yield* reply(TASKS.keepChecking);
    return { state, flagged: false };
  }
  if (state.reExplanations >= maxReExplanations) {
    yield* reply(TASKS.handBack);
    return { state: { ...state, step: "ended" }, flagged: true };
  }
  yield* reply(TASKS.reExplain(state.reExplanations));
  return { state: { ...state, reExplanations: state.reExplanations + 1 }, flagged: false };
}

/** The opening line the Learner never typed; providers need a conversation to start with the user. */
const KICK_OFF = "Hi! I'm ready to learn.";

/** The transcript as an LLM conversation, ending with the Learner's latest message. */
function conversation({ transcript, learnerMessage }: TutorTurnInput): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "user", content: KICK_OFF }];
  for (const { role, content } of transcript) messages.push({ role: role === "learner" ? "user" : "assistant", content });
  if (learnerMessage !== undefined) messages.push({ role: "user", content: learnerMessage });
  // The re-teaching follows the Quiz rather than a message, and providers need the conversation to end with the user.
  if (messages.at(-1)?.role === "assistant") messages.push({ role: "user", content: QUIZ_DONE });
  return messages;
}

/** Stands in for the Learner after a Quiz attempt, whose answers aren't part of the transcript. */
const QUIZ_DONE = "I've finished the quiz.";

async function* streamText(events: AsyncIterable<ChatEvent>): AsyncGenerator<string, void> {
  for await (const event of events) if (event.type === "text") yield event.text;
}

/** Each re-explanation tries the next of these, so a second try isn't the first one again. */
const APPROACHES = [
  "use simpler words and shorter sentences, one idea at a time",
  "work through a fresh example step by step",
  "use an everyday analogy or story the Learner can picture",
];

const TASKS = {
  explain:
    "Explain the Learning Objectives step by step, with one simple example. Then ask the Learner one short question that checks they understood.",
  keepChecking:
    "You are checking the Learner's understanding. Reply to what they just said: if they asked something, answer it; if they went off-topic, gently bring them back. Then ask one short question about the Learning Objectives. Don't give answers away.",
  advance:
    "The Learner has shown they understand. Praise them briefly for something specific they got right, and tell them a short quiz on this Lesson comes next. Don't ask another question.",
  reExplain: (attempt: number) =>
    // Past the listed approaches (the Parent may allow more re-explanations), the transcript shows what has been tried.
    `The Learner hasn't understood yet. Explain the Learning Objectives again in a new way: ${
      APPROACHES[attempt] ?? "a different approach from every explanation you've given so far in this conversation"
    }. Don't repeat any earlier explanation. Then ask one short question that checks they understood.`,
  handBack:
    "The Learner is still finding this tricky, so you'll stop here for today and their Parent will help them with it. End kindly: praise their effort, tell them it's fine to find things hard, and that they'll come back to it. Don't explain further or ask a question.",
  reTeach: (missed: string[]) =>
    `The Learner just finished a quiz on this Lesson and didn't reach the pass mark. Encourage them briefly, then re-teach only these Learning Objectives, which they got wrong, in a new way with a worked example:\n${bullets(missed)}\nDon't re-teach the other Learning Objectives. End by telling them a new quiz with different questions comes next. Don't ask a question.`,
};

function systemPrompt(lesson: TutorLesson, grade: string, task: string): string {
  return `You are a friendly, patient Tutor teaching one Lesson to a child.\n\n${lessonContext(lesson, grade)}\n\n${GUARDRAILS}\n\nYour task now: ${task}`;
}

const VERDICTS = ["advance", "re-explain", "continue"] as const;
type Verdict = (typeof VERDICTS)[number];

const VERDICT_SCHEMA: JsonSchema = {
  type: "object",
  properties: { verdict: { type: "string", enum: [...VERDICTS] } },
  required: ["verdict"],
  additionalProperties: false,
};

/** The Understanding Check decision on the Learner's latest message, as structured output. */
async function understandingVerdict(llm: TutorLlm, lesson: TutorLesson, grade: string, messages: ChatMessage[]): Promise<Verdict> {
  const system = `You are assessing a child's understanding during a tutoring Lesson.\n\n${lessonContext(lesson, grade)}

Read the conversation, especially the Learner's latest message, and decide:
- "advance" if the Learner clearly understands the Learning Objectives well enough to take a quiz on them;
- "re-explain" if their answer shows a misunderstanding, or they say they don't understand;
- "continue" if it isn't clear yet, for example they asked a question, went off-topic or gave a partial answer.`;
  const { data } = await llm.structured({ system, messages, schema: VERDICT_SCHEMA });
  const verdict = (data as { verdict?: unknown } | null)?.verdict;
  if (!VERDICTS.includes(verdict as Verdict)) throw new LlmError("failed", "The Understanding Check verdict was not one of the allowed values.");
  return verdict as Verdict;
}
