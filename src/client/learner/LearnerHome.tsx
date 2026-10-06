import { useEffect, useState } from "react";
import type { GoalCard, LoggedInLearner } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";
import { SessionChat } from "./SessionChat";

export function LearnerHome({ learner, onLogout }: { learner: LoggedInLearner; onLogout: () => void }) {
  const [cards, setCards] = useState<GoalCard[]>();
  const [error, setError] = useState<string>();
  const [openGoal, setOpenGoal] = useState<number>();
  const loadCards = () => void api.goalCards().then(setCards, () => setError(text.genericError));
  useEffect(loadCards, []);

  // A Session may have changed the Goals (a Flagged Goal leaves the list), so reload them on the way back.
  if (openGoal !== undefined) return <SessionChat goalId={openGoal} onBack={() => (setOpenGoal(undefined), loadCards())} />;
  return (
    <section>
      <h1>{text.learnerHome.heading(learner.name)}</h1>
      {error && <p className="error">{error}</p>}
      {!cards && !error && <p>{text.loading}</p>}
      {cards?.length === 0 && <p>{text.learnerHome.noGoals}</p>}
      {cards && cards.length > 0 && <p>{text.learnerHome.goalsIntro}</p>}
      {cards?.map((card) => (
        <article key={card.id} className={card.overdue ? "card goal-card catch-up" : "card goal-card"}>
          <p className="subject">{card.subjectName}</p>
          <h2>{text.goalTitle(card.kind, card.title)}</h2>
          {/* Gentle wording for the Learner; the Parent sees "Overdue" plainly. */}
          <p className="hint">{card.overdue ? text.learnerHome.catchUp : text.learnerHome.target(card.targetDate)}</p>
          <button type="button" onClick={() => setOpenGoal(card.id)}>
            {text.learnerHome.start}
          </button>
        </article>
      ))}
      <button type="button" onClick={() => api.logoutLearner().then(onLogout)}>
        {text.learnerHome.logout}
      </button>
    </section>
  );
}
