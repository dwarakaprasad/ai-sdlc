import { useEffect, useState } from "react";
import type { LearnerToday, QuizScore, TutorSession } from "../../shared/api";
import { api } from "../api";
import { ArrowIcon, StarIcon } from "../components/icons";
import { Confetti } from "../components/Confetti";
import { Button } from "../components/ui";
import { text } from "../text";

/**
 * The Goal-met celebration: a drawn check and light confetti, the score, the Learner's Goals met and the Subject's Term
 * progress, and the Subject's next Goal ready to start. Meeting the Goal has already moved the Subject's queue on, so these
 * come from the home data as it now is.
 */
export function GoalMet({
  session,
  score,
  onHome,
  onOpenGoal,
}: {
  session: TutorSession;
  score: QuizScore;
  onHome: () => void;
  onOpenGoal: (goalId: number) => void;
}) {
  const [today, setToday] = useState<LearnerToday>();
  useEffect(() => void api.today().then(setToday, () => undefined), [session.id]);
  const subject = today?.subjects.find((s) => s.subjectKey === session.subjectKey);
  const next = subject?.card;

  return (
    <main className="goal-met screen-enter">
      <Confetti />
      <svg className="goal-met-check" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="54" className="goal-met-track" />
        <circle cx="60" cy="60" r="54" className="goal-met-ring" />
        <path d="M38 62 l15 15 l30 -32" className="goal-met-tick" />
      </svg>
      <span className="eyebrow">{text.goalMet.eyebrow(session.subjectName)}</span>
      <h1 className="display goal-met-title">{text.goalTitle(session.kind, session.title)}</h1>
      <p className="lead goal-met-score">{text.goalMet.score(score.correct, score.total, text.goalMet.scoreLine[session.kind])}</p>
      {today && (
        <dl className="goal-met-stats">
          <div>
            <dt>{text.goalMet.goalsMet}</dt>
            <dd className="goal-met-goals">
              <StarIcon size={18} /> {today.goalsMet}
            </dd>
          </div>
          {subject?.term && (
            <div>
              <dt>{text.goalMet.thisTerm(session.subjectName)}</dt>
              <dd>{text.learnerHome.termProgress(subject.term.met, subject.term.total)}</dd>
            </div>
          )}
        </dl>
      )}
      {next && (
        <article className="up-next">
          <div>
            <span className="eyebrow">{text.goalMet.upNext}</span>
            <strong>{text.goalTitle(next.kind, next.title)}</strong>
            <span className="up-next-when">{text.goalMet.when(next.subjectName, next.targetDate)}</span>
          </div>
          <Button className="up-next-start" onClick={() => onOpenGoal(next.id)}>
            {text.goalMet.start} <ArrowIcon size={18} />
          </Button>
        </article>
      )}
      <Button kind="quiet" onClick={onHome}>
        {text.session.back}
      </Button>
    </main>
  );
}
