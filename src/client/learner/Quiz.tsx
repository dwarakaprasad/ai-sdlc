import { useState, type FormEvent } from "react";
import type { QuizAttempt, TutorSession } from "../../shared/api";
import { api } from "../api";
import { MathText } from "../components/MathText";
import { text } from "../text";

/** Starts the next Quiz attempt; the Tutor writes the questions first. */
export function QuizStart({ session, onStarted, onChanged }: { session: TutorSession; onStarted: (s: TutorSession) => void; onChanged: () => void }) {
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Why the Quiz can't start today: the daily token cap, or a Curriculum the Parent needs to fix. */
  const [stopped, setStopped] = useState<string>();

  async function start() {
    setWriting(true);
    setFailed(false);
    const result = await api.startQuiz(session.id).catch(() => ({ error: "llmFailed" }));
    setWriting(false);
    if ("id" in result) return onStarted(result);
    // Another tab started the attempt first: show it.
    if (result.error === "sessionChanged" || result.error === "noQuizNow") return onChanged();
    if (result.error === "dailyLimitReached" || result.error === "lessonUnavailable") return setStopped(text.quiz.errors[result.error]);
    setFailed(true);
  }

  if (writing) return <p className="hint" aria-live="polite">{text.quiz.writing}</p>;
  if (stopped) return <p className="hint">{stopped}</p>;
  return (
    <div className="quiz">
      {failed && <p className="error">{text.quiz.failed}</p>}
      <button type="button" onClick={() => void start()}>
        {failed ? text.session.retry : session.quiz ? text.quiz.startAgain : text.quiz.start}
      </button>
    </div>
  );
}

/**
 * A Quiz attempt, one question at a time: right or wrong with a one-line explanation after each answer,
 * then the score and what comes next. Resuming starts at the first unanswered question.
 */
export function QuizPanel({
  session,
  quiz,
  onAnswered,
  onChanged,
  onContinue,
}: {
  session: TutorSession;
  quiz: QuizAttempt;
  onAnswered: (s: TutorSession) => void;
  onChanged: () => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState("");
  /** The question just answered, whose feedback shows until the Learner moves on. */
  const [reviewing, setReviewing] = useState<number>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();

  const index = reviewing !== undefined ? quiz.questions.findIndex((q) => q.id === reviewing) : quiz.questions.findIndex((q) => !q.answered);
  const question = quiz.questions[index];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question || draft.trim() === "") return;
    setChecking(true);
    setError(undefined);
    const result = await api.answer(session.id, question.id, draft.trim()).catch(() => ({ error: "llmFailed" }));
    setChecking(false);
    if ("error" in result) {
      if (result.error === "sessionChanged") return onChanged();
      return setError(text.quiz.errors[result.error] ?? text.quiz.failed);
    }
    const answered = { ...question, answered: { answer: draft.trim(), ...result.feedback } };
    onAnswered({
      ...session,
      step: result.step,
      quiz: { ...quiz, score: result.score, questions: quiz.questions.map((q) => (q.id === question.id ? answered : q)) },
    });
    setReviewing(question.id);
    setDraft("");
  }

  const heading = (
    <h2>
      {text.quiz.heading[session.kind]}
      {quiz.number > 1 && <span className="hint"> · {text.quiz.attempt(quiz.number, quiz.maxAttempts)}</span>}
    </h2>
  );

  if (!question && quiz.score) {
    return (
      <div className="quiz card" aria-live="polite">
        {heading}
        <p className="score">{text.quiz.score(quiz.score.correct, quiz.score.total)}</p>
        {session.step === "goal-met" && <p>{text.quiz.met[session.kind]}</p>}
        {session.step === "ended" && <p className="hint">{text.quiz.ended}</p>}
        {session.step === "re-teaching" && (
          <>
            <p>{text.quiz.reTeach}</p>
            <button type="button" onClick={onContinue}>
              {text.quiz.continue}
            </button>
          </>
        )}
      </div>
    );
  }
  if (!question) return null;

  const feedback = question.answered;
  return (
    <div className="quiz card">
      {heading}
      <p className="hint">{text.quiz.question(index + 1, quiz.questions.length)}</p>
      <div className="prompt">
        <MathText text={question.prompt} />
      </div>
      {feedback ? (
        <div className={feedback.correct ? "feedback right" : "feedback wrong"} aria-live="polite">
          <p>
            <strong>{feedback.correct ? text.quiz.right : text.quiz.wrong}</strong> <MathText text={feedback.explanation} />
          </p>
          {!feedback.correct && (
            <p className="hint">
              <MathText text={text.quiz.correctAnswer(feedback.correctAnswer)} />
            </p>
          )}
          <button type="button" onClick={() => setReviewing(undefined)}>
            {quiz.score ? text.quiz.seeScore : text.quiz.next}
          </button>
        </div>
      ) : (
        <form className="answer" onSubmit={submit}>
          {question.type === "multiple-choice" && (
            <fieldset className="choices">
              {question.choices.map((choice) => (
                <label key={choice} className="choice">
                  <input type="radio" name={`q${question.id}`} value={choice} checked={draft === choice} onChange={() => setDraft(choice)} />
                  <MathText text={choice} />
                </label>
              ))}
            </fieldset>
          )}
          {question.type === "number" && (
            <label>
              {text.quiz.numberLabel}
              <input type="text" inputMode="decimal" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <span className="hint">{text.quiz.numberHint}</span>
            </label>
          )}
          {question.type === "short-answer" && (
            <label>
              {text.quiz.writtenLabel}
              <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={checking || draft.trim() === ""}>
            {checking ? text.quiz.checking : text.quiz.submit}
          </button>
        </form>
      )}
    </div>
  );
}
