import { useEffect, useState } from "react";
import type { GoalCard, QuizScore, TutorSession } from "../../shared/api";
import { api } from "../api";
import { ArrowIcon } from "../components/icons";
import { Confetti } from "../components/Confetti";
import { Button } from "../components/ui";
import { text } from "../text";

/**
 * The Goal-met celebration: a drawn check and light confetti, the score, and the Subject's next Goal ready to start.
 * Meeting the Goal has already moved the Subject's queue on, so its next Goal is whatever the home screen now shows for it.
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
  const [next, setNext] = useState<GoalCard | null>();
  useEffect(
    () => void api.goalCards().then((cards) => setNext(cards.find((c) => c.subjectName === session.subjectName) ?? null), () => setNext(null)),
    [session.id],
  );

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
      {next && (
        <article className="up-next">
          <div>
            <span className="eyebrow">{text.goalMet.upNext}</span>
            <strong>{text.goalTitle(next.kind, next.title)}</strong>
            <span className="up-next-when">
              {next.subjectName} · {text.learnerHome.target(next.targetDate)}
            </span>
          </div>
          <Button className="up-next-start" onClick={() => onOpenGoal(next.id)}>
            {text.goalMet.start} <ArrowIcon size={18} />
          </Button>
        </article>
      )}
      <Button kind="quiet" onClick={onHome}>
        {text.goalMet.home}
      </Button>
    </main>
  );
}
