import { useState } from "react";
import type { GoalProgress, Learner, SessionTranscript } from "../../shared/api";
import { api } from "../api";
import { MathText } from "../components/MathText";
import { text } from "../text";

/**
 * A Learner's progress for the Parent: how many Goals are met, overdue, flagged or orphaned, and under each Goal its
 * Sessions with every finished Quiz attempt's score, and a transcript to read.
 */
export function Progress({ learner }: { learner: Learner }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<GoalProgress[]>();
  const [transcript, setTranscript] = useState<SessionTranscript>();
  const [error, setError] = useState<string>();

  async function toggle() {
    if (open) return (setOpen(false), setTranscript(undefined));
    setOpen(true);
    setProgress(await api.progress(learner.id).catch(() => (setError(text.genericError), undefined)));
  }

  async function read(sessionId: number) {
    setTranscript(await api.transcript(learner.id, sessionId).catch(() => (setError(text.genericError), undefined)));
  }

  const count = (has: (g: GoalProgress) => boolean) => progress?.filter(has).length ?? 0;
  return (
    <>
      <button type="button" onClick={() => void toggle()}>
        {open ? text.progress.hide : text.progress.show}
      </button>
      {open && error && <p className="error">{error}</p>}
      {open && !progress && !error && <p>{text.loading}</p>}
      {open && progress && (
        <div className="progress">
          <p>
            {text.progress.summary(
              count((g) => g.status === "met"),
              count((g) => g.overdue),
              count((g) => g.status === "flagged"),
              count((g) => g.orphaned),
            )}
          </p>
          <ul>
            {progress.map((goal) => (
              <li key={goal.id}>
                {text.goals.goal(goal.subjectName, text.goalTitle(goal.kind, goal.title), goal.targetDate)}
                {text.goals.status[goal.status] && ` · ${text.goals.status[goal.status]}`}
                {goal.overdue && <span className="overdue"> · {text.goals.overdue}</span>}
                {goal.orphaned && <span className="overdue"> · {text.goals.orphaned}</span>}
                <ul>
                  {goal.sessions.length === 0 && <li className="hint">{text.progress.noSessions}</li>}
                  {goal.sessions.map((s) => (
                    <li key={s.id}>
                      {text.progress.session(s.startedAt, s.endedAt === null)}{" "}
                      <button type="button" className="link" onClick={() => void read(s.id)}>
                        {text.progress.readTranscript}
                      </button>
                      {s.attempts.map((a) => (
                        <div key={a.number} className="hint">
                          {text.progress.attempt(a.number, a.correct, a.total, a.passed)}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {transcript && <Transcript transcript={transcript} onClose={() => setTranscript(undefined)} />}
        </div>
      )}
    </>
  );
}

/** One Session as the Parent reads it: every message, then each Quiz attempt's questions and answers. */
function Transcript({ transcript, onClose }: { transcript: SessionTranscript; onClose: () => void }) {
  return (
    <section className="card">
      <p className="subject">{transcript.subjectName}</p>
      <h4>{text.goalTitle(transcript.kind, transcript.title)}</h4>
      <p className="hint">{text.progress.session(transcript.startedAt, transcript.endedAt === null)}</p>
      {transcript.messages.length === 0 && <p className="hint">{text.progress.noMessages}</p>}
      <ol className="transcript">
        {transcript.messages.map((m, i) => (
          <li key={i} className={m.role}>
            <span className="speaker">{m.role === "tutor" ? text.session.tutor : text.session.you}</span>
            {m.role === "tutor" ? <MathText text={m.content} /> : m.content}
          </li>
        ))}
      </ol>
      {transcript.attempts.map((a) => (
        <div key={a.number}>
          <h5>{text.progress.quizHeading(a.number)}</h5>
          {a.score && <p>{text.quiz.score(a.score.correct, a.score.total)}</p>}
          <ol>
            {a.questions.map((q, i) => (
              <li key={i}>
                <MathText text={text.progress.question(i + 1, q.prompt)} />
                <div className="hint">{text.progress.answer(q.answer, q.correct, q.answerKey)}</div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <button type="button" onClick={onClose}>
        {text.progress.closeTranscript}
      </button>
    </section>
  );
}
