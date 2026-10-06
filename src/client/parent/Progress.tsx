import { useEffect, useState } from "react";
import type { GoalProgress, Learner, SessionTranscript } from "../../shared/api";
import { api } from "../api";
import { BackIcon, FlameIcon } from "../components/icons";
import { MathText } from "../components/MathText";
import { TutorMark } from "../components/TutorMark";
import { Button, Card, Tag } from "../components/ui";
import { text } from "../text";

/**
 * A Learner's progress for the Parent: how many Goals are met, overdue, flagged or orphaned, their Streak, and under each Goal its
 * Sessions with every finished Quiz attempt's score, and a transcript to read.
 */
export function Progress({ learner }: { learner: Learner }) {
  const [progress, setProgress] = useState<GoalProgress[]>();
  const [transcript, setTranscript] = useState<SessionTranscript>();
  const [error, setError] = useState<string>();

  useEffect(() => void api.progress(learner.id).then(setProgress, () => setError(text.genericError)), [learner.id]);

  async function read(sessionId: number) {
    setTranscript(await api.transcript(learner.id, sessionId).catch(() => (setError(text.genericError), undefined)));
  }

  if (transcript) return <Transcript transcript={transcript} learnerName={learner.name} onClose={() => setTranscript(undefined)} />;
  if (error) return <p className="text-warm">{error}</p>;
  if (!progress) return <p className="muted">{text.loading}</p>;
  if (progress.length === 0) return <p className="muted">{text.progress.noGoals}</p>;
  const count = (has: (g: GoalProgress) => boolean) => progress.filter(has).length;
  const summary = [
    ["met", count((g) => g.status === "met")],
    ["overdue", count((g) => g.overdue)],
    ["flagged", count((g) => g.status === "flagged")],
    ["orphaned", count((g) => g.orphaned)],
  ] as const;
  return (
    <>
      <dl className="stat-row" aria-label={text.progress.summaryLabel}>
        {summary.map(([key, n]) => (
          <div key={key} className={`card stat stat-${key}`}>
            <dt className="eyebrow">{text.progress.summary[key]}</dt>
            <dd>{n}</dd>
          </div>
        ))}
        <div className="card stat stat-streak">
          <dt className="eyebrow">{text.progress.streak}</dt>
          <dd>
            <FlameIcon size={20} /> {learner.streak}
          </dd>
        </div>
      </dl>
      <ul className="progress-goals">
        {progress.map((goal) => (
          <li key={goal.id} className="card progress-goal">
            <div className="progress-goal-head">
              <span className="eyebrow">{goal.subjectName}</span>
              <h3 className="h3">{text.goalTitle(goal.kind, goal.title)}</h3>
              <span className={`goal-status status-${goal.status}`}>{text.goals.status[goal.status]}</span>
              {goal.overdue && <Tag tone="warm">{text.goals.daysOverdue(goal.daysOverdue)}</Tag>}
              {goal.orphaned && <Tag tone="warm">{text.goals.orphaned}</Tag>}
            </div>
            {goal.sessions.length === 0 ? (
              <p className="muted">{text.progress.noSessions}</p>
            ) : (
              <ul className="session-list">
                {goal.sessions.map((s) => (
                  <li key={s.id}>
                    <span>{text.progress.session(s.startedAt, s.endedAt === null)}</span>
                    {s.attempts.map((a) => (
                      <span key={a.number} className={a.passed ? "attempt attempt-passed" : "attempt"}>
                        {text.progress.attempt(a.number, a.correct, a.total, a.passed)}
                      </span>
                    ))}
                    <Button kind="quiet" onClick={() => void read(s.id)}>
                      {text.progress.readTranscript}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** One Session as the Parent reads it: every message, drawn as in the Session itself, then each Quiz attempt's questions and answers. */
function Transcript({ transcript, learnerName, onClose }: { transcript: SessionTranscript; learnerName: string; onClose: () => void }) {
  return (
    <section className="transcript-view" aria-label={text.progress.transcriptLabel}>
      <Button kind="quiet" onClick={onClose}>
        <BackIcon size={18} /> {text.progress.closeTranscript}
      </Button>
      <div>
        <span className="eyebrow">{transcript.subjectName}</span>
        <h2 className="h2">{text.goalTitle(transcript.kind, transcript.title)}</h2>
        <p className="muted">{text.progress.session(transcript.startedAt, transcript.endedAt === null)}</p>
      </div>
      <Card>
        {transcript.messages.length === 0 && <p className="muted">{text.progress.noMessages}</p>}
        <ol className="transcript">
          {transcript.messages.map((m, i) =>
            m.role === "tutor" ? (
              <li key={i} className="tutor-reply">
                <div className="tutor-header">
                  <TutorMark size={24} /> {text.session.tutor}
                </div>
                <div className="tutor-text">
                  <MathText text={m.content} />
                </div>
              </li>
            ) : (
              <li key={i} className="learner-note">
                <span className="visually-hidden">{learnerName}: </span>
                {m.content}
              </li>
            ),
          )}
        </ol>
      </Card>
      {transcript.attempts.map((a) => (
        <Card key={a.number} className="transcript-quiz">
          <h3 className="h3">{text.progress.quizHeading(a.number)}</h3>
          {a.score && <p className="muted">{text.quiz.score(a.score.correct, a.score.total)}</p>}
          <ol className="transcript-questions">
            {a.questions.map((q, i) => (
              <li key={i}>
                <MathText text={text.progress.question(i + 1, q.prompt)} />
                <div className={q.correct === false ? "text-warm" : "muted"}>{text.progress.answer(q.answer, q.correct, q.answerKey)}</div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </section>
  );
}
