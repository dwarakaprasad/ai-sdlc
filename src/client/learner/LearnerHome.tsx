import { useEffect, useState } from "react";
import type { GoalCard, LearnerToday, LoggedInLearner, SubjectToday } from "../../shared/api";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { StreakChip, StreakWeek } from "../components/Streak";
import { ArrowIcon, ClockIcon, ParentIcon, StarIcon } from "../components/icons";
import { TopBar } from "../components/TopBar";
import { TutorMark } from "../components/TutorMark";
import { Button, Card, Meter, Tag } from "../components/ui";
import { text } from "../text";
import { LearningPathScreen } from "./LearningPath";
import { SessionChat } from "./SessionChat";

/** The logged-in Learner's app: Today, a Subject's Learning Path, and a Session once they start a Goal. */
export function LearnerHome({ learner, onLogout }: { learner: LoggedInLearner; onLogout: () => void }) {
  const [today, setToday] = useState<LearnerToday>();
  const [error, setError] = useState<string>();
  const [openGoal, setOpenGoal] = useState<number>();
  /** The Subject whose Learning Path is showing, instead of Today. */
  const [pathSubjectKey, setPathSubjectKey] = useState<string>();
  const loadToday = () => void api.today().then(setToday, () => setError(text.genericError));
  useEffect(loadToday, []);

  if (openGoal !== undefined) {
    // Keyed by the Goal, so moving straight on to the Up next Goal starts its Session afresh. A Session may have changed
    // the Goals (one met, or handed to the Parent), so Today reloads on the way back.
    return <SessionChat key={openGoal} goalId={openGoal} onBack={() => (setOpenGoal(undefined), loadToday())} onOpenGoal={setOpenGoal} />;
  }
  return (
    <div className="learner-app">
      <TopBar
        nav={[
          { label: text.learnerNav.today, current: pathSubjectKey === undefined, onSelect: () => (setPathSubjectKey(undefined), loadToday()) },
          // The Path of the Subject to continue: the first on Today.
          ...(today?.subjects[0]
            ? [{ label: text.learnerNav.learningPath, current: pathSubjectKey !== undefined, onSelect: () => setPathSubjectKey(pathSubjectKey ?? today.subjects[0]!.subjectKey) }]
            : []),
        ]}
        end={
          <>
            {today && <StreakChip days={today.streak.days} />}
            <button type="button" className="switch-profile" aria-label={text.learnerNav.switchProfile} onClick={() => api.logoutLearner().then(onLogout)}>
              <Avatar {...learner} size={36} />
            </button>
          </>
        }
      />
      {pathSubjectKey !== undefined ? (
        <main className="page screen-enter" key={pathSubjectKey}>
          <LearningPathScreen
            subjectKey={pathSubjectKey}
            onStart={setOpenGoal}
            onBack={() => setPathSubjectKey(undefined)}
          />
        </main>
      ) : (
        <main className="page screen-enter">
          <h1 className="h1">{text.learnerHome.heading(learner.name)}</h1>
          {error && <p className="text-warm">{error}</p>}
          {!today && !error && <p className="muted">{text.loading}</p>}
          {today && <Today today={today} onStart={setOpenGoal} onOpenPath={setPathSubjectKey} />}
        </main>
      )}
    </div>
  );
}

/** Today: the Goal to continue, what the Learner has achieved, and every Subject with its own Goal to start. */
function Today({ today, onStart, onOpenPath }: { today: LearnerToday; onStart: (goalId: number) => void; onOpenPath: (subjectKey: string) => void }) {
  if (today.subjects.length === 0) {
    return (
      <Card className="home-empty">
        <TutorMark size={56} mood="resting" />
        <p>{text.learnerHome.noGoals}</p>
      </Card>
    );
  }
  // The Subjects come earliest Target Date first, so the first is the one to continue (an overdue Goal comes first).
  const [first] = today.subjects;
  return (
    <>
      <div className="home-grid">
        {first?.card ? (
          <ContinueCard subject={first} card={first.card} onStart={onStart} />
        ) : (
          <Card className="home-empty">
            <TutorMark size={56} mood="resting" />
            <p>{text.learnerHome.nothingNow}</p>
          </Card>
        )}
        <Card className="achievements">
          <StreakWeek streak={today.streak} />
          <div className="achievement">
            <span className="eyebrow">{text.learnerHome.goalsMet}</span>
            <strong className="achievement-goals">
              <StarIcon size={18} /> {today.goalsMet}
            </strong>
          </div>
        </Card>
      </div>
      <h2 className="h3 home-section">{text.learnerHome.allSubjects}</h2>
      <ul className="subject-rows">
        {today.subjects.map((subject) => (
          <SubjectRow key={subject.subjectKey} subject={subject} onStart={onStart} onOpenPath={() => onOpenPath(subject.subjectKey)} />
        ))}
      </ul>
    </>
  );
}

/** The Goal to do next, with the Tutor beside it and one button to start. */
function ContinueCard({ subject, card, onStart }: { subject: SubjectToday; card: GoalCard; onStart: (goalId: number) => void }) {
  return (
    <article className="continue-card">
      <div className="continue-art">
        <TutorMark size={120} />
        <div className="continue-shape" />
      </div>
      <div className="continue-body">
        <span className="eyebrow">{text.learnerHome.continueEyebrow(subject.subjectName, subject.term?.termName)}</span>
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
          <Button onClick={() => onStart(card.id)}>
            {text.learnerHome.continue} <ArrowIcon size={18} />
          </Button>
        </div>
      </div>
    </article>
  );
}

/** One Subject: its current Goal and a Start button, or why there's nothing to start; and how far through its Term it is. */
function SubjectRow({ subject, onStart, onOpenPath }: { subject: SubjectToday; onStart: (goalId: number) => void; onOpenPath: () => void }) {
  const { card, term } = subject;
  return (
    <li className={subject.withParent ? "subject-row with-parent" : "subject-row"}>
      <button type="button" className="subject-row-name" onClick={onOpenPath}>
        {subject.subjectName}
      </button>
      <span className="subject-row-goal">
        {card ? (
          <>
            {text.goalTitle(card.kind, card.title)} {card.overdue && <Tag tone="warm">{text.learnerHome.catchUpTag}</Tag>}
          </>
        ) : subject.withParent ? (
          <span className="subject-row-parent">
            <ParentIcon size={18} /> {text.learnerHome.withParent}
          </span>
        ) : (
          <span className="muted">{text.learnerHome.allDone}</span>
        )}
      </span>
      {term ? (
        <span className="subject-row-meter">
          <Meter value={term.met} total={term.total} label={text.learnerHome.termProgressLabel(subject.subjectName, term.termName, term.met, term.total)} />
          <small>{text.learnerHome.termProgress(term.met, term.total)}</small>
        </span>
      ) : (
        <span className="subject-row-meter" />
      )}
      {card ? (
        <Button kind="outline" onClick={() => onStart(card.id)}>
          {text.learnerHome.start}
        </Button>
      ) : (
        <span />
      )}
    </li>
  );
}
