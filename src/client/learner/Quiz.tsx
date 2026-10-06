import { useState, type FormEvent } from "react";
import type { QuizAttempt, QuizQuestion, TutorSession } from "../../shared/api";
import { api } from "../api";
import { ArrowIcon, CheckIcon, CloseIcon, SparkleIcon } from "../components/icons";
import { MathText } from "../components/MathText";
import { TutorMark } from "../components/TutorMark";
import { Button, Card } from "../components/ui";
import { text } from "../text";

/** Starts the next Quiz attempt from the foot of the conversation; the Tutor writes the questions first. */
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

  return (
    <footer className="quiz-start" aria-live="polite">
      <TutorMark size={40} mood={writing ? "thinking" : stopped ? "resting" : "happy"} />
      <div className="quiz-start-text">
        {writing ? (
          <strong>{text.quiz.writing}</strong>
        ) : stopped ? (
          <span>{stopped}</span>
        ) : (
          <>
            <strong>{text.session.quizReady[session.kind]}</strong>
            {failed ? <span className="text-warm">{text.quiz.failed}</span> : <span className="muted">{text.session.quizReadyHint[session.kind]}</span>}
          </>
        )}
      </div>
      {!writing && !stopped && (
        <Button onClick={() => void start()}>
          {failed ? text.session.retry : session.quiz ? text.quiz.startAgain : text.quiz.start} <ArrowIcon size={18} />
        </Button>
      )}
    </footer>
  );
}

/** How an answered question went, which the screens show in green or the warm "not quite" colour; undefined until it's answered. */
function resultOf(question: QuizQuestion): "right" | "wrong" | undefined {
  return question.answered && (question.answered.correct ? "right" : "wrong");
}

/** The bar over a Quiz: a way out, what is being taken, and (while answering) one segment per question coloured by result. */
function QuizTop({ session, quiz, onLeave, segments = true }: { session: TutorSession; quiz: QuizAttempt; onLeave: () => void; segments?: boolean }) {
  const right = quiz.questions.filter((q) => q.answered?.correct).length;
  const wrong = quiz.questions.filter((q) => q.answered && !q.answered.correct).length;
  const current = quiz.questions.findIndex((q) => !q.answered);
  return (
    <header className="quiz-top">
      <Button kind="quiet" onClick={onLeave}>
        <CloseIcon size={18} /> {text.session.leave}
      </Button>
      <span className="muted quiz-top-title">{text.quiz.topTitle(session.kind, session.title, quiz.number, quiz.maxAttempts)}</span>
      {segments && (
        <span className="quiz-segments" role="img" aria-label={text.quiz.progress(right, wrong, quiz.questions.length)}>
          {quiz.questions.map((q, i) => (
            <span key={q.id} className={resultOf(q) ?? (i === current ? "now" : "")} />
          ))}
        </span>
      )}
    </header>
  );
}

/**
 * A Quiz attempt, one question per card: the answer, Check, then right or wrong inline with its one-line explanation,
 * and Continue. Resuming starts at the first unanswered question.
 */
export function QuizScreen({
  session,
  quiz,
  reviewing,
  onAnswered,
  onNext,
  onChanged,
  onLeave,
}: {
  session: TutorSession;
  quiz: QuizAttempt;
  /** The question just answered, whose feedback shows until the Learner moves on. */
  reviewing: number | undefined;
  onAnswered: (s: TutorSession, questionId: number) => void;
  onNext: () => void;
  onChanged: () => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();

  const index = reviewing !== undefined ? quiz.questions.findIndex((q) => q.id === reviewing) : quiz.questions.findIndex((q) => !q.answered);
  const question = quiz.questions[index];
  if (!question) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question || draft.trim() === "" || checking) return;
    setChecking(true);
    setError(undefined);
    const result = await api.answer(session.id, question.id, draft.trim()).catch(() => ({ error: "llmFailed" }));
    setChecking(false);
    if ("error" in result) {
      if (result.error === "sessionChanged") return onChanged();
      return setError(text.quiz.errors[result.error] ?? text.quiz.failed);
    }
    const answered = { ...question, answered: { answer: draft.trim(), ...result.feedback } };
    onAnswered(
      {
        ...session,
        step: result.step,
        quiz: { ...quiz, score: result.score, questions: quiz.questions.map((q) => (q.id === question.id ? answered : q)) },
      },
      question.id,
    );
    setDraft("");
  }

  const feedback = question.answered;
  return (
    <div className="quiz-app screen-enter">
      <QuizTop session={session} quiz={quiz} onLeave={onLeave} />
      <form className="quiz-card" onSubmit={feedback ? (e) => (e.preventDefault(), onNext()) : submit}>
        <span className="eyebrow">{text.quiz.question(index + 1, quiz.questions.length)}</span>
        <h1 className="quiz-prompt">
          <MathText text={question.prompt} />
        </h1>
        <Answer key={question.id} question={question} draft={draft} onDraft={setDraft} />
        {feedback && (
          <div className={`quiz-feedback ${resultOf(question)}`} aria-live="polite">
            <span className="quiz-feedback-mark" aria-hidden>
              {feedback.correct ? <CheckIcon size={18} /> : <SparkleIcon size={18} />}
            </span>
            <div>
              <strong>{feedback.correct ? text.quiz.right : text.quiz.wrong}</strong> <MathText text={feedback.explanation} />
              {!feedback.correct && (
                <div className="quiz-feedback-answer">
                  <MathText text={text.quiz.correctAnswer(feedback.correctAnswer)} />
                </div>
              )}
            </div>
          </div>
        )}
        {error && <p className="text-warm">{error}</p>}
        <footer className="quiz-foot">
          {feedback ? (
            <Button type="submit" autoFocus>
              {text.quiz.next} <ArrowIcon size={18} />
            </Button>
          ) : (
            <Button type="submit" disabled={checking || draft.trim() === ""}>
              {checking ? text.quiz.checking : text.quiz.submit}
            </Button>
          )}
        </footer>
      </form>
    </div>
  );
}

/** The answer to one question: large option rows, a large number field, or a roomy box for a written answer. Locked once answered. */
function Answer({ question, draft, onDraft }: { question: QuizQuestion; draft: string; onDraft: (value: string) => void }) {
  const answered = question.answered;
  if (question.type === "multiple-choice") {
    return (
      <fieldset className="quiz-options" disabled={!!answered}>
        <legend className="visually-hidden">{text.quiz.choicesLabel}</legend>
        {question.choices.map((choice) => {
          const picked = answered ? answered.answer === choice : draft === choice;
          // Once answered, the right choice and the Learner's pick are marked, and the rest fade back.
          const state = answered ? (choice === answered.correctAnswer ? "right" : picked ? "wrong" : "dim") : picked ? "picked" : "";
          return (
            <label key={choice} className={`quiz-option ${state}`}>
              <input type="radio" name={`q${question.id}`} value={choice} checked={picked} onChange={() => onDraft(choice)} />
              <span className="quiz-radio" aria-hidden />
              <MathText text={choice} />
              {state === "right" && <span className="visually-hidden"> {text.quiz.rightChoice}</span>}
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (question.type === "number") {
    return (
      <label className="quiz-number">
        <span className="eyebrow">{text.quiz.numberLabel}</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder={text.quiz.numberPlaceholder}
          readOnly={!!answered}
          value={answered ? answered.answer : draft}
          onChange={(e) => onDraft(e.target.value)}
        />
        <span className="muted quiz-hint">{text.quiz.numberHint}</span>
      </label>
    );
  }
  return (
    <label className="quiz-written">
      <span className="eyebrow">{text.quiz.writtenLabel}</span>
      <textarea
        rows={4}
        autoFocus
        placeholder={text.quiz.writtenPlaceholder}
        readOnly={!!answered}
        value={answered ? answered.answer : draft}
        onChange={(e) => onDraft(e.target.value)}
      />
    </label>
  );
}

/** Each Learning Objective a finished attempt got wrong at least once, in the order the questions asked them. */
function missedObjectives(quiz: QuizAttempt): string[] {
  return [...new Set(quiz.questions.flatMap((q) => (q.answered && !q.answered.correct ? [q.answered.objective] : [])))];
}

/**
 * A finished attempt that didn't pass: the score, each question marked right or not quite, and what comes next. After a
 * failed attempt that's going over the missed Learning Objectives with the Tutor; after the last one allowed, the Parent helps.
 */
export function ScoreScreen({ session, quiz, onLeave, onGoOver }: { session: TutorSession; quiz: QuizAttempt; onLeave: () => void; onGoOver: () => void }) {
  const score = quiz.score!;
  const missed = missedObjectives(quiz);
  return (
    <div className="quiz-app screen-enter">
      <QuizTop session={session} quiz={quiz} onLeave={onLeave} segments={false} />
      <main className="quiz-score">
        <section>
          <span className="eyebrow">{text.quiz.attempt(quiz.number, quiz.maxAttempts)}</span>
          <p className="quiz-score-number" aria-label={text.quiz.score(score.correct, score.total)}>
            {score.correct}
            <span>{text.quiz.outOf(score.total)}</span>
          </p>
          <ol className="quiz-score-list">
            {quiz.questions.map((q) => (
              <li key={q.id} className={resultOf(q)}>
                <span className="quiz-score-mark" aria-hidden>
                  {q.answered?.correct ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
                </span>
                <span>
                  <span className="visually-hidden">{q.answered?.correct ? text.quiz.markedRight : text.quiz.markedWrong} </span>
                  <MathText text={q.prompt} />
                </span>
              </li>
            ))}
          </ol>
        </section>
        <Card className="quiz-score-next">
          {session.step === "ended" ? (
            <>
              <TutorMark size={56} mood="resting" />
              <h1 className="h2">{text.quiz.ended}</h1>
              <div>
                <Button onClick={onLeave}>{text.session.back}</Button>
              </div>
            </>
          ) : (
            <>
              <TutorMark size={56} />
              <h1 className="h2">{text.quiz.reTeachHeading}</h1>
              <ul className="missed-objectives">
                {missed.map((objective) => (
                  <li key={objective}>
                    <ArrowIcon size={16} /> {objective}
                  </li>
                ))}
              </ul>
              <p className="muted">{text.quiz.reTeachHint}</p>
              <div>
                <Button onClick={onGoOver}>
                  {text.quiz.goOver} <ArrowIcon size={18} />
                </Button>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
