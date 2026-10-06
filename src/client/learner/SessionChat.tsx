import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { SessionMessage, SessionStep, TutorSession } from "../../shared/api";
import { TUTOR_STARTED_STEPS } from "../../shared/api";
import { api } from "../api";
import { BackIcon, CheckIcon, SendIcon } from "../components/icons";
import { MathText } from "../components/MathText";
import { TutorMark } from "../components/TutorMark";
import { Button, Card } from "../components/ui";
import { text } from "../text";
import { GoalMet } from "./GoalMet";
import { QuizScreen, QuizStart, ScoreScreen } from "./Quiz";

/**
 * A Tutor Session on one Goal. The conversation (the transcript, the Tutor's reply as it streams in, and the Learner's
 * answer box) sits beside a panel with the Lesson's steps and Learning Objectives. A Quiz attempt takes over the screen,
 * one question at a time, and ends on its score (when failed) or on the Goal-met celebration.
 */
export function SessionChat({ goalId, onBack, onOpenGoal }: { goalId: number; onBack: () => void; onOpenGoal: (goalId: number) => void }) {
  const [session, setSession] = useState<TutorSession>();
  const [streaming, setStreaming] = useState<string>();
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  /** The Parent's daily token cap was reached, so the Tutor won't reply until tomorrow. */
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string>();
  /** The Lesson can't be taught: the Curriculum is invalid, or no longer has it. */
  const [unavailable, setUnavailable] = useState(false);
  /** The Quiz question just answered, whose feedback shows until the Learner moves on (even past the attempt's last). */
  const [reviewing, setReviewing] = useState<number>();
  /**
   * A failed attempt's score is showing: straight after its last answer, or on coming back before its re-teaching. It stays
   * until the Learner goes over the missed parts with the Tutor.
   */
  const [showScore, setShowScore] = useState(false);
  /** How many break prompts the Learner has waved away this sitting; each restarts the timer. */
  const [breaksSkipped, setBreaksSkipped] = useState(0);
  const [breakDue, setBreakDue] = useState(false);
  const breakMinutes = session?.breakMinutes;

  // The break prompt counts from when this sitting opened the Session, not from when the Session first started.
  useEffect(() => {
    if (breakMinutes === undefined) return;
    const timer = setTimeout(() => setBreakDue(true), breakMinutes * 60_000);
    return () => clearTimeout(timer);
  }, [breakMinutes, breaksSkipped]);

  /** Opens (or resumes) the Session; a new one, or one whose Explanation never arrived, starts with the Explanation. */
  async function open(isCancelled = () => false) {
    try {
      const opened = await api.openSession(goalId);
      if (isCancelled()) return;
      if ("error" in opened) return opened.error === "lessonUnavailable" ? setUnavailable(true) : setError(text.genericError);
      setError(undefined);
      setUnavailable(false);
      setReviewing(undefined);
      setShowScore(opened.step === "re-teaching");
      setSession(opened);
      if (opened.step === "explanation") await takeTurn(opened);
    } catch {
      setError(text.genericError);
    }
  }

  /** One turn; the Learner's message shows straight away, and goes back to the answer box if the turn fails. */
  async function takeTurn(current: TutorSession, message?: string) {
    const pending: SessionMessage[] = message === undefined ? current.messages : [...current.messages, { role: "learner", content: message }];
    setSession({ ...current, messages: pending });
    setFailed(false);
    setStreaming("");
    let reply = "";
    const result = await api
      .turn(current.id, message, (piece) => {
        reply += piece;
        setStreaming(reply);
      })
      .catch(() => ({ error: "llmFailed" as const }));
    setStreaming(undefined);
    if ("step" in result) return setSession({ ...current, step: result.step, messages: [...pending, { role: "tutor", content: reply }] });
    setSession(current);
    if (message !== undefined) setDraft(message);
    // Another tab moved the Session on first: show where it is now. A turn refused because the Curriculum became invalid
    // also lands here, and re-opening the Session shows the Learner why.
    if (result.error === "sessionChanged") return open();
    if (result.error === "dailyLimitReached") return setLimited(true);
    setFailed(true);
  }

  useEffect(() => {
    // Development mode runs effects twice; only the second may start the Explanation.
    let cancelled = false;
    void open(() => cancelled);
    return () => void (cancelled = true);
  }, [goalId]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!session || draft.trim() === "" || streaming !== undefined) return;
    const message = draft.trim();
    setDraft("");
    await takeTurn(session, message);
  }

  if (unavailable) return <LessonNotice message={text.session.lessonUnavailable} onBack={onBack} />;
  if (error) return <LessonNotice message={error} onBack={onBack} />;
  if (!session) return <p className="muted notice-page">{text.loading}</p>;

  const quiz = session.quiz;
  const busy = streaming !== undefined;
  const breakBanner = breakDue && (
    <BreakBanner
      minutes={session.breakMinutes * (breaksSkipped + 1)}
      onKeepGoing={() => (setBreakDue(false), setBreaksSkipped((n) => n + 1))}
      onBreak={onBack}
    />
  );
  // The Quiz screens have no conversation to hold the break prompt, so it floats over them.
  const withBreak = (screen: React.ReactNode) => (
    <>
      {screen}
      {breakBanner && <div className="break-float">{breakBanner}</div>}
    </>
  );

  if (quiz && (session.step === "quiz" || reviewing !== undefined)) {
    return withBreak(
      <QuizScreen
        session={session}
        quiz={quiz}
        reviewing={reviewing}
        onAnswered={(answered, questionId) => {
          setSession(answered);
          setReviewing(questionId);
          // The attempt's last answer: a failed attempt shows its score next.
          setShowScore(answered.quiz?.score !== undefined && !answered.quiz.score.passed);
        }}
        onNext={() => setReviewing(undefined)}
        onChanged={() => void open()}
        onLeave={onBack}
      />,
    );
  }
  if (quiz?.score && session.step === "goal-met") return <GoalMet session={session} score={quiz.score} onHome={onBack} onOpenGoal={onOpenGoal} />;
  if (quiz?.score && showScore) {
    return withBreak(
      <ScoreScreen
        session={session}
        quiz={quiz}
        onLeave={onBack}
        onGoOver={() => {
          setShowScore(false);
          void takeTurn(session);
        }}
      />,
    );
  }

  return (
    <div className="chat-app screen-enter">
      <LessonPanel session={session} onLeave={onBack} />
      <section className="convo">
        <Conversation messages={session.messages} streaming={streaming}>
          {breakBanner}
          {limited && <TutorNote mood="resting">{text.session.dailyLimit}</TutorNote>}
          {failed && (
            <div className="convo-failed">
              <p className="text-warm">{text.session.failed}</p>
              {/* A failed answer is back in the answer box to send again; a failed Explanation or re-teaching needs this button. */}
              {TUTOR_STARTED_STEPS.includes(session.step) && (
                <Button kind="outline" onClick={() => void takeTurn(session)}>
                  {text.session.retry}
                </Button>
              )}
            </div>
          )}
          {session.step === "ended" && <TutorNote mood="resting">{text.session.ended}</TutorNote>}
        </Conversation>
        {session.step === "understanding-check" && (
          <form className="composer" onSubmit={send}>
            <textarea
              aria-label={text.session.messageLabel}
              placeholder={text.session.messagePlaceholder}
              rows={1}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => {
                // Enter sends; Shift+Enter starts a new line.
                if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), void send());
              }}
            />
            <Button type="submit" className="composer-send" aria-label={text.session.send} disabled={busy || draft.trim() === ""}>
              <SendIcon />
            </Button>
          </form>
        )}
        {!busy && session.step === "ready-for-quiz" && !failed && (
          <QuizStart session={session} onStarted={setSession} onChanged={() => void open()} />
        )}
      </section>
    </div>
  );
}

/**
 * Where each step of `text.session.steps` stands while the Session is at `step`: done, now, or still to come. A Lesson's steps
 * are the Explanation, the Understanding Check and the Lesson Quiz (with its re-teaching); a Unit Test has just the one.
 */
function stepStates(kind: TutorSession["kind"], step: SessionStep): ("done" | "now" | "later")[] {
  if (kind === "unit-test") return [step === "goal-met" ? "done" : "now"];
  const now = step === "explanation" ? 0 : step === "understanding-check" ? 1 : step === "goal-met" ? 3 : 2;
  return [0, 1, 2].map((i) => (i < now ? "done" : i === now ? "now" : "later"));
}

/** The Lesson beside the conversation: its title, where the Session is in the steps, and its Learning Objectives. */
function LessonPanel({ session, onLeave }: { session: TutorSession; onLeave: () => void }) {
  const states = stepStates(session.kind, session.step);
  return (
    <aside className="lesson-panel">
      <Button kind="quiet" className="lesson-leave" onClick={onLeave}>
        <BackIcon size={16} /> {text.session.leave}
      </Button>
      <span className="eyebrow">{session.subjectName}</span>
      <h1 className="h2">{text.goalTitle(session.kind, session.title)}</h1>
      <ol className="lesson-steps" aria-label={text.session.stepsLabel}>
        {text.session.steps[session.kind].map((label, i) => (
          <li key={label} className={states[i]} aria-current={states[i] === "now" ? "step" : undefined}>
            <span className="lesson-step-mark" aria-hidden>
              {states[i] === "done" ? <CheckIcon size={12} /> : i + 1}
            </span>
            {label}
            {states[i] === "done" && <span className="visually-hidden"> {text.session.stepDone}</span>}
          </li>
        ))}
      </ol>
      <Card className="lesson-objectives">
        <span className="eyebrow">{text.session.objectivesHeading}</span>
        <ul>
          {session.learningObjectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}

/** The transcript in document style: the Tutor's replies as text under Jarvis's mark, the Learner's as small notes on the right. */
function Conversation({ messages, streaming, children }: { messages: SessionMessage[]; streaming: string | undefined; children: React.ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  // Keep the newest words in view as the reply streams in.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, streaming]);
  return (
    <div className="convo-scroll">
      <ol className="transcript" aria-label={text.session.conversationLabel}>
        {messages.map((m, i) =>
          m.role === "tutor" ? (
            <li key={i} className="tutor-reply">
              <TutorHeader />
              <div className="tutor-text">
                <MathText text={m.content} />
              </div>
            </li>
          ) : (
            <li key={i} className="learner-note">
              <span className="visually-hidden">{text.session.you}: </span>
              {m.content}
            </li>
          ),
        )}
        {streaming !== undefined && (
          <li className="tutor-reply" aria-live="polite">
            <TutorHeader writing />
            <div className="tutor-text writing">
              <MathText text={streaming} />
            </div>
          </li>
        )}
      </ol>
      {children}
      <div ref={end} />
    </div>
  );
}

/** Jarvis's mark and name over a reply, looking up and "writing…" while it streams in. */
function TutorHeader({ writing = false }: { writing?: boolean }) {
  return (
    <header className="tutor-header">
      <TutorMark size={28} mood={writing ? "thinking" : "idle"} /> {text.session.tutor}
      {writing && <span className="muted">{text.session.writing}</span>}
    </header>
  );
}

/** A calm word from the Tutor inside the conversation, such as the daily cap being reached. */
function TutorNote({ mood, children }: { mood: "resting" | "idle"; children: React.ReactNode }) {
  return (
    <div className="tutor-note" role="status">
      <TutorMark size={40} mood={mood} />
      <p>{children}</p>
    </div>
  );
}

/** The break prompt, as a calm banner in the conversation with Jarvis resting. */
function BreakBanner({ minutes, onKeepGoing, onBreak }: { minutes: number; onKeepGoing: () => void; onBreak: () => void }) {
  return (
    <div className="break-banner screen-enter" role="status">
      <TutorMark size={40} mood="resting" />
      <div className="break-text">
        <strong>{text.session.breakHeading(minutes)}</strong>
        <span className="muted">{text.session.breakHint}</span>
      </div>
      <Button kind="outline" onClick={onKeepGoing}>
        {text.session.keepGoing}
      </Button>
      <Button onClick={onBreak}>{text.session.takeBreak}</Button>
    </div>
  );
}

/** Shown in place of the Session when it can't go on, say while its Lesson can't be taught: a calm note, not an error page. */
function LessonNotice({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main className="notice-page screen-enter">
      <Card className="notice">
        <TutorMark size={72} mood="resting" />
        <p className="notice-text">{message}</p>
        <Button onClick={onBack}>
          <BackIcon size={18} /> {text.session.back}
        </Button>
      </Card>
    </main>
  );
}
