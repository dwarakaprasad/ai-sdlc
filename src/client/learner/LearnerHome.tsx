import { useEffect, useState } from "react";
import type { GoalCard, LoggedInLearner } from "../../shared/api";
import { api } from "../api";
import { ArrowIcon, ClockIcon } from "../components/icons";
import { TopBar } from "../components/TopBar";
import { TutorMark } from "../components/TutorMark";
import { Button, Card, Initial, Tag } from "../components/ui";
import { text } from "../text";
import { SessionChat } from "./SessionChat";

export function LearnerHome({ learner, onLogout }: { learner: LoggedInLearner; onLogout: () => void }) {
  const [cards, setCards] = useState<GoalCard[]>();
  const [error, setError] = useState<string>();
  const [openGoal, setOpenGoal] = useState<number>();
  const loadCards = () => void api.goalCards().then(setCards, () => setError(text.genericError));
  useEffect(loadCards, []);

  // A Session may have changed the Goals (a Flagged Goal leaves the list), so reload them on the way back.
  if (openGoal !== undefined) {
    // Keyed by the Goal, so moving straight on to the Up next Goal starts its Session afresh.
    return <SessionChat key={openGoal} goalId={openGoal} onBack={() => (setOpenGoal(undefined), loadCards())} onOpenGoal={setOpenGoal} />;
  }
  // The cards come earliest Target Date first, so the first is the one to continue (an overdue Goal comes first).
  const [next, ...others] = cards ?? [];
  return (
    <div className="learner-app">
      <TopBar
        nav={[{ label: text.learnerNav.today, current: true, onSelect: loadCards }]}
        end={
          <button type="button" className="switch-profile" aria-label={text.learnerNav.switchProfile} onClick={() => api.logoutLearner().then(onLogout)}>
            <Initial name={learner.name} size={36} />
          </button>
        }
      />
      <main className="page screen-enter">
        <h1 className="h1">{text.learnerHome.heading(learner.name)}</h1>
        {error && <p className="text-warm">{error}</p>}
        {!cards && !error && <p className="muted">{text.loading}</p>}
        {cards?.length === 0 && (
          <Card className="home-empty">
            <TutorMark size={56} mood="resting" />
            <p>{text.learnerHome.noGoals}</p>
          </Card>
        )}
        {next && <ContinueCard card={next} onStart={() => setOpenGoal(next.id)} />}
        {others.length > 0 && (
          <>
            <h2 className="h3 home-section">{text.learnerHome.moreGoals}</h2>
            <ul className="subject-rows">
              {others.map((card) => (
                <li key={card.id} className="subject-row">
                  <span className="subject-row-name">{card.subjectName}</span>
                  <span className="subject-row-goal">
                    {text.goalTitle(card.kind, card.title)} {card.overdue && <Tag tone="warm">{text.learnerHome.catchUpTag}</Tag>}
                    {!card.overdue && <small className="muted">{text.learnerHome.target(card.targetDate)}</small>}
                  </span>
                  <Button kind="outline" onClick={() => setOpenGoal(card.id)}>
                    {text.learnerHome.start}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

/** The Goal to do next, with the Tutor beside it and one button to start. */
function ContinueCard({ card, onStart }: { card: GoalCard; onStart: () => void }) {
  return (
    <article className="continue-card">
      <div className="continue-art">
        <TutorMark size={120} />
        <div className="continue-shape" />
      </div>
      <div className="continue-body">
        <span className="eyebrow">{card.subjectName}</span>
        <h2 className="h2">{text.goalTitle(card.kind, card.title)}</h2>
        {/* Gentle wording for the Learner; the Parent sees "Overdue" plainly. */}
        {card.overdue ? (
          <p className="text-warm continue-note">
            <ClockIcon size={16} /> {text.learnerHome.catchUp}
          </p>
        ) : (
          <p className="muted continue-note">{text.learnerHome.target(card.targetDate)}</p>
        )}
        <div>
          <Button onClick={onStart}>
            {text.learnerHome.continue} <ArrowIcon size={18} />
          </Button>
        </div>
      </div>
    </article>
  );
}
