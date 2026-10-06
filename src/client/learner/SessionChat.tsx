import { useEffect, useState, type FormEvent } from "react";
import type { SessionMessage, TutorSession } from "../../shared/api";
import { TUTOR_STARTED_STEPS } from "../../shared/api";
import { api } from "../api";
import { MathText } from "../components/MathText";
import { text } from "../text";
import { QuizPanel, QuizStart } from "./Quiz";

/** A Tutor Session on one Goal: the transcript, the Tutor's reply as it streams in, and the Learner's answer box. */
export function SessionChat({ goalId, onBack }: { goalId: number; onBack: () => void }) {
  const [session, setSession] = useState<TutorSession>();
  const [streaming, setStreaming] = useState<string>();
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  /** The Parent's daily token cap was reached, so the Tutor won't reply until tomorrow. */
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string>();
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
      if ("error" in opened) return setError(text.session.errors[opened.error] ?? text.genericError);
      setError(undefined);
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

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!session || draft.trim() === "") return;
    const message = draft.trim();
    setDraft("");
    await takeTurn(session, message);
  }

  const busy = streaming !== undefined;
  return (
    <section className="session">
      <button type="button" className="link" onClick={onBack}>
        {text.session.back}
      </button>
      {error && <p className="error">{error}</p>}
      {!session && !error && <p>{text.loading}</p>}
      {session && breakDue && (
        <p className="break" role="status">
          {text.session.breakPrompt(session.breakMinutes * (breaksSkipped + 1))}{" "}
          <button type="button" onClick={() => (setBreakDue(false), setBreaksSkipped((n) => n + 1))}>
            {text.session.keepGoing}
          </button>
        </p>
      )}
      {session && (
        <>
          <p className="subject">{session.subjectName}</p>
          <h1>{text.goalTitle(session.kind, session.title)}</h1>
          <ol className="transcript">
            {session.messages.map((m, i) => (
              <li key={i} className={m.role}>
                <span className="speaker">{m.role === "tutor" ? text.session.tutor : text.session.you}</span>
                {m.role === "tutor" ? <MathText text={m.content} /> : m.content}
              </li>
            ))}
            {busy && (
              <li className="tutor" aria-live="polite">
                <span className="speaker">{text.session.tutor}</span>
                {streaming ? <MathText text={streaming} /> : <span className="hint">{text.session.thinking}</span>}
              </li>
            )}
          </ol>
          {limited && <p className="hint">{text.session.dailyLimit}</p>}
          {failed && (
            <p className="error">
              {text.session.failed}{" "}
              {/* A failed answer is back in the answer box to send again; a failed Explanation or re-teaching needs this button. */}
              {TUTOR_STARTED_STEPS.includes(session.step) && (
                <button type="button" onClick={() => void takeTurn(session)}>
                  {text.session.retry}
                </button>
              )}
            </p>
          )}
          {session.step === "understanding-check" && (
            <form className="answer" onSubmit={send}>
              <label>
                {text.session.messageLabel}
                <textarea rows={3} value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button type="submit" disabled={busy || draft.trim() === ""}>
                {text.session.send}
              </button>
            </form>
          )}
          {!busy && session.step === "ready-for-quiz" && <QuizStart session={session} onStarted={setSession} onChanged={() => void open()} />}
          {session.quiz && session.step !== "ready-for-quiz" && !failed && !busy && (
            <QuizPanel
              session={session}
              quiz={session.quiz}
              onAnswered={setSession}
              onChanged={() => void open()}
              onContinue={() => void takeTurn(session)}
            />
          )}
          {session.step === "ended" && !session.quiz && <p className="hint">{text.session.ended}</p>}
        </>
      )}
    </section>
  );
}
