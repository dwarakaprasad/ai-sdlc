// PROTOTYPE (throwaway) — Direction A, "Playground": close to Duolingo.
// White canvas, one saturated green action, chunky 3D buttons, a winding Learning Path, uppercase button labels,
// a left rail + right "stats" column on tablet/laptop.
import { useState } from "react";
import { MathText } from "../../../src/client/MathText";
import {
  ACCENTS, AVATARS, elaPath, groupBy, goalsMet, me, missedObjectives, nextUp, parentGoals, parentLearners, profiles, session,
  shortDate, streak, subjects, today, type AvatarId, type PathNode,
} from "../data";
import { Avatar, Confetti, OwlTutor, type Mood } from "../shared/art";
import { daysLate, useQuiz, useStream, type ScreenId, type VariantProps } from "../shared/hooks";
import * as Ic from "../shared/icons";
import "./a.css";

const SUBJECT_COLOR: Record<string, string> = { math: "#1cb0f6", ela: "#2ec4b6", social: "#7a6cff", science: "#00b386" };

export function VariantA({ screen, tutorName, go }: VariantProps) {
  return (
    <div className="va">
      {screen === "profiles" && <Profiles go={go} />}
      {screen === "avatar" && <AvatarPick go={go} tutorName={tutorName} />}
      {screen === "home" && <Shell go={go} tab="home"><Home go={go} tutorName={tutorName} /></Shell>}
      {screen === "path" && <Shell go={go} tab="path"><LearningPath go={go} /></Shell>}
      {screen === "chat" && <Chat go={go} tutorName={tutorName} />}
      {screen.startsWith("quiz") && <QuizScreen screen={screen} go={go} tutorName={tutorName} />}
      {screen === "goal-met" && <GoalMet go={go} tutorName={tutorName} />}
      {screen === "parent" && <ParentGoals go={go} />}
    </div>
  );
}

function Btn({ kind = "green", children, onClick, wide, small }: { kind?: "green" | "blue" | "ghost" | "warm" | "white"; children: React.ReactNode; onClick?: () => void; wide?: boolean; small?: boolean }) {
  return <button className={`a-btn a-btn-${kind}${wide ? " wide" : ""}${small ? " small" : ""}`} onClick={onClick}>{children}</button>;
}

function Bar({ value, total, color = "var(--green)" }: { value: number; total: number; color?: string }) {
  return (
    <div className="a-bar"><span style={{ width: `${(value / total) * 100}%`, background: color }} /></div>
  );
}

/* ---------- 1 Profile picker ---------- */
function Profiles({ go }: { go: (s: ScreenId) => void }) {
  return (
    <main className="a-center screen-enter">
      <OwlTutor size={84} mood="idle" />
      <h1 className="a-h1">Who's learning today?</h1>
      <div className="a-profiles">
        {profiles.map((p) => (
          <button key={p.id} className="a-profile" onClick={() => go(p.avatar ? "home" : "avatar")}>
            <span className="a-profile-pic" style={{ "--c": p.color } as React.CSSProperties}>
              <Avatar id={p.avatar} color={p.color} name={p.name} size={112} />
              {p.hasPin && <span className="a-pin"><Ic.Lock size={16} /></span>}
            </span>
            <span className="a-profile-name">{p.name}</span>
          </button>
        ))}
      </div>
      <button className="a-link" onClick={() => go("parent")}>Parent area</button>
    </main>
  );
}

/* ---------- 2 Avatar pick ---------- */
function AvatarPick({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const [pick, setPick] = useState<AvatarId | null>(null);
  const [color, setColor] = useState("#3ecf8e");
  return (
    <div className="a-flow screen-enter">
      <header className="a-flow-top">
        <button className="a-icon-btn" onClick={() => go("profiles")} aria-label="Back"><Ic.Close size={24} /></button>
        <Bar value={1} total={2} />
      </header>
      <main className="a-flow-body">
        <div className="a-say">
          <OwlTutor size={92} mood="happy" />
          <div className="a-bubble">Hi Leo, I'm {tutorName}! Pick a look so your brothers and sisters know which profile is yours.</div>
        </div>
        <div className="a-avatar-stage">
          <div className="a-avatar-preview a-bounce" key={`${pick}${color}`}>
            <Avatar id={pick} color={color} name="Leo" size={128} />
          </div>
          <div>
            <h2 className="a-h3">Choose your picture</h2>
            <div className="a-avatar-grid">
              {AVATARS.map((id) => (
                <button key={id} className={`a-avatar-opt${pick === id ? " on" : ""}`} onClick={() => setPick(id)} aria-label={id}>
                  <Avatar id={id} color={pick === id ? color : "#c9d1dc"} name={id} size={56} />
                </button>
              ))}
            </div>
            <h2 className="a-h3">And your colour</h2>
            <div className="a-swatches">
              {ACCENTS.map((c) => (
                <button key={c} className={`a-swatch${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="a-flow-foot">
        <Btn kind={pick ? "green" : "ghost"} onClick={() => pick && go("home")}>Looks good</Btn>
      </footer>
    </div>
  );
}

/* ---------- Shell: left rail, centre column, right stats ---------- */
function Shell({ go, tab, children }: { go: (s: ScreenId) => void; tab: "home" | "path"; children: React.ReactNode }) {
  return (
    <div className="a-shell">
      <nav className="a-rail">
        <div className="a-logo">home<b>tutor</b></div>
        <button className={tab === "home" ? "on" : ""} onClick={() => go("home")}><Ic.Home size={26} /> <span>Learn</span></button>
        <button className={tab === "path" ? "on" : ""} onClick={() => go("path")}><Ic.PathIcon size={26} /> <span>Path</span></button>
        <button onClick={() => go("profiles")}><Avatar id={me.avatar} color={me.color} name={me.name} size={28} /> <span>Switch</span></button>
      </nav>
      <main className="a-main screen-enter">{children}</main>
      <aside className="a-side">
        <StreakCard />
        <div className="a-card a-stat">
          <span className="a-stat-icon gold"><Ic.Star size={26} /></span>
          <div><b className="a-big">{goalsMet}</b><div className="a-muted">Goals met this year</div></div>
        </div>
      </aside>
    </div>
  );
}

function StreakCard() {
  return (
    <div className="a-card a-streak">
      <div className="a-streak-head">
        <span className="a-flame"><Ic.Flame size={30} strokeWidth={2.2} /></span>
        <div><b className="a-big">{streak.days} day streak</b><div className="a-muted">Weekends never break it</div></div>
      </div>
      <div className="a-week">
        {streak.week.map((d, i) => (
          <div key={i} className={`a-day ${d.state}`}>
            <span>{d.state === "worked" ? <Ic.Check size={14} strokeWidth={3.5} /> : d.state === "today" ? <Ic.Flame size={14} /> : ""}</span>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 3 Home ---------- */
function Home({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <>
      <div className="a-hello">
        <OwlTutor size={64} />
        <div className="a-bubble small">Good afternoon, {me.name}! Pick up where you left off.</div>
      </div>
      <div className="a-mobile-stats">
        <span className="a-chip orange"><Ic.Flame size={18} /> {streak.days}</span>
        <span className="a-chip gold"><Ic.Star size={18} /> {goalsMet}</span>
      </div>
      <div className="a-cards">
        {subjects.map((s) => {
          const Icon = Ic.SUBJECT_ICON[s.key]!;
          const color = SUBJECT_COLOR[s.key]!;
          return (
            <section key={s.key} className={`a-card a-goal${s.withParent ? " parent" : ""}${s.card?.overdue ? " overdue" : ""}`}>
              {s.card?.overdue && (
                <div className="a-catchup"><Ic.Clock size={18} /> Waiting since {shortDate(s.card.targetDate)}. Let's catch up!</div>
              )}
              <div className="a-goal-row">
                <span className="a-subject-tile" style={{ background: color }}><Icon size={30} strokeWidth={2.2} /></span>
                <div className="a-goal-text">
                  <button className="a-subject" onClick={() => go("path")}>{s.name} <Ic.Arrow size={14} /></button>
                  {s.withParent ? (
                    <h3 className="a-goal-title">With your Parent</h3>
                  ) : (
                    <h3 className="a-goal-title">{s.card!.kind === "unit-test" ? `Unit Test: ${s.card!.title}` : s.card!.title}</h3>
                  )}
                  <div className="a-goal-progress">
                    <Bar value={s.met} total={s.total} color={s.withParent ? "#c9b6e8" : color} />
                    <small>{s.met}/{s.total}</small>
                  </div>
                </div>
                {s.withParent ? (
                  <span className="a-parent-note"><Ic.Parent size={20} /> They'll pick what's next</span>
                ) : (
                  <Btn kind="green" onClick={() => go("chat")}>Start</Btn>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="a-muted a-center-text">{tutorName} is ready whenever you are.</p>
    </>
  );
}

/* ---------- 4 Learning Path ---------- */
const OFFSETS = [0, -70, -100, -70, 0, 70, 100, 70];

function LearningPath({ go }: { go: (s: ScreenId) => void }) {
  let i = 0;
  return (
    <div className="a-path">
      <button className="a-back" onClick={() => go("home")}><Ic.Back size={18} /> Home</button>
      {elaPath.units.map((u, ui) => (
        <section key={u.key} className="a-unit">
          <header className="a-unit-banner" data-u={ui}>
            <div><small>{elaPath.subject} · {elaPath.term} · Unit {u.key}</small><h2>{u.title}</h2></div>
            <Ic.Book size={28} />
          </header>
          <div className="a-nodes">
            {u.nodes.map((n) => <PathNodeA key={n.key + n.kind} n={n} x={OFFSETS[i++ % OFFSETS.length]!} go={go} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function PathNodeA({ n, x, go }: { n: PathNode; x: number; go: (s: ScreenId) => void }) {
  const icon = {
    met: <Ic.Check size={34} strokeWidth={3.4} />,
    current: n.kind === "unit-test" ? <Ic.Trophy size={32} /> : <Ic.Star size={34} strokeWidth={2.6} />,
    skipped: <Ic.Skip size={28} />,
    "with-parent": <Ic.Parent size={30} />,
    ahead: n.kind === "unit-test" ? <Ic.Trophy size={32} /> : <Ic.Lock size={28} />,
  }[n.state];
  const label = { met: "Done", current: "Up next", skipped: "Skipped", "with-parent": "With your Parent", ahead: "" }[n.state];
  return (
    <div className="a-node-wrap" style={{ translate: `${x}px 0` }}>
      {n.state === "current" && <div className="a-node-tip"><div><small>Lesson {n.key} · up next</small>{n.title}</div><Btn small onClick={() => go("chat")}>Start</Btn></div>}
      <button className={`a-node ${n.state} ${n.kind}`} disabled={n.state !== "current"} onClick={() => go("chat")} aria-label={`${n.title}: ${n.state}`}>
        {icon}
      </button>
      {n.state !== "current" && <div className="a-node-label">
        <b>{n.kind === "unit-test" ? "Unit Test" : `Lesson ${n.key}`}</b>
        <span>{n.kind === "unit-test" ? "" : n.title}{label && `${n.kind === "unit-test" ? "" : " · "}${label}`}</span>
      </div>}
    </div>
  );
}

/* ---------- 5 Session chat ---------- */
function Chat({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const s = useStream();
  return (
    <div className="a-flow screen-enter">
      <header className="a-flow-top">
        <button className="a-icon-btn" onClick={() => go("home")} aria-label="Leave"><Ic.Close size={24} /></button>
        <div className="a-steps">
          <span className="done">Learn</span><span className="on">Check</span><span>Quiz</span>
        </div>
        <span className="a-chat-title">{session.subjectName} · {session.title}</span>
      </header>
      <main className="a-chat">
        {session.messages.map((m, i) => (
          m.role === "tutor" ? (
            <div key={i} className="a-msg tutor"><OwlTutor size={44} /><div className="a-bubble"><MathText text={m.content} /></div></div>
          ) : (
            <div key={i} className="a-msg me"><div className="a-bubble me">{m.content}</div></div>
          )
        ))}
        <div className="a-msg tutor">
          <OwlTutor size={44} mood={s.done ? "idle" : "thinking"} />
          <div className={`a-bubble${s.done ? "" : " caret"}`}>
            <span className="a-who">{tutorName}</span>
            <MathText text={s.text} />
          </div>
        </div>
        {s.done && (
          <div className="a-break screen-enter">
            <OwlTutor size={72} mood="rest" />
            <div>
              <h3 className="a-h3">You've been working for {session.breakMinutes} minutes</h3>
              <p className="a-muted">Time for a short break? Stretch, get a drink, then come back.</p>
              <div className="a-row"><Btn kind="blue" onClick={() => go("home")}><Ic.Coffee size={18} /> Take a break</Btn><Btn kind="ghost" onClick={s.replay}>Keep going</Btn></div>
            </div>
          </div>
        )}
      </main>
      <footer className="a-flow-foot a-composer">
        <input placeholder={`Answer ${tutorName}…`} />
        <Btn onClick={() => go("quiz")}><Ic.Send size={20} /></Btn>
      </footer>
    </div>
  );
}

/* ---------- 6 Quiz ---------- */
function QuizScreen({ screen, go, tutorName }: { screen: ScreenId; go: (s: ScreenId) => void; tutorName: string }) {
  const q = useQuiz(screen);
  if (q.done) return <QuizScore go={go} tutorName={tutorName} retry={q.retry} results={q.results} />;
  const question = q.question!;
  const fb = q.feedback;
  const mood: Mood = fb ? (fb.correct ? "happy" : "idle") : "idle";
  return (
    <div className="a-flow screen-enter">
      <header className="a-flow-top">
        <button className="a-icon-btn" onClick={() => go("home")} aria-label="Leave"><Ic.Close size={24} /></button>
        <Bar value={q.index + (fb ? 1 : 0)} total={q.total} />
        <span className="a-muted nowrap">Attempt 1 of 3</span>
      </header>
      <main className="a-quiz">
        <small className="a-kicker">Question {q.index + 1} of {q.total}</small>
        <div className="a-say">
          <OwlTutor size={84} mood={mood} />
          <h1 className="a-bubble a-prompt"><MathText text={question.prompt} /></h1>
        </div>
        {question.type === "multiple-choice" && (
          <div className="a-choices">
            {question.choices.map((c, i) => {
              const picked = q.draft === c;
              const state = fb && picked ? (fb.correct ? "right" : "wrong") : fb && c === fb.correctAnswer ? "right" : picked ? "on" : "";
              return (
                <button key={c} className={`a-choice ${state}`} onClick={() => q.setDraft(c)}>
                  <kbd>{i + 1}</kbd><MathText text={c} />
                </button>
              );
            })}
          </div>
        )}
        {question.type === "number" && (
          <input className={`a-input big ${fb ? (fb.correct ? "right" : "wrong") : ""}`} inputMode="decimal" placeholder="Type a number"
            value={q.draft} onChange={(e) => q.setDraft(e.target.value)} />
        )}
        {question.type === "short-answer" && (
          <textarea className={`a-input ${fb ? (fb.correct ? "right" : "wrong") : ""}`} rows={4} placeholder="Write your answer in a sentence or two"
            value={q.draft} onChange={(e) => q.setDraft(e.target.value)} />
        )}
      </main>
      <footer className={`a-flow-foot a-sheet ${fb ? (fb.correct ? "right" : "wrong") : ""}`}>
        {fb ? (
          <>
            <div className="a-fb">
              <span className={`a-fb-icon ${fb.correct ? "a-bounce" : ""}`}>{fb.correct ? <Ic.Check size={30} strokeWidth={3.6} /> : <Ic.Sparkle size={28} />}</span>
              <div>
                <h3>{fb.correct ? "Nice one!" : "Not quite"}</h3>
                {!fb.correct && <p><b>Answer:</b> <MathText text={fb.correctAnswer} /></p>}
                <p><MathText text={fb.explanation} /></p>
              </div>
            </div>
            <Btn kind={fb.correct ? "green" : "warm"} onClick={q.next}>Continue</Btn>
          </>
        ) : (
          <>
            <span />
            <Btn kind={q.draft.trim() ? "green" : "ghost"} onClick={q.check}>Check</Btn>
          </>
        )}
      </footer>
    </div>
  );
}

function QuizScore({ go, tutorName, retry, results }: { go: (s: ScreenId) => void; tutorName: string; retry: () => void; results: boolean[] }) {
  const right = results.filter(Boolean).length;
  return (
    <main className="a-center screen-enter a-score">
      <OwlTutor size={110} mood="idle" />
      <h1 className="a-h1">{right} of {results.length} right</h1>
      <div className="a-score-blocks">
        {results.map((r, i) => <span key={i} className={r ? "right" : "wrong"}>{r ? <Ic.Check size={22} strokeWidth={3.4} /> : i + 1}</span>)}
      </div>
      <div className="a-card a-missed">
        <h3 className="a-h3">Let's look again at the parts you missed</h3>
        <ul>{missedObjectives.map((o) => <li key={o}>{o}</li>)}</ul>
        <p className="a-muted">{tutorName} will go over them with you, then you can try again. You have 2 attempts left.</p>
      </div>
      <div className="a-row">
        <Btn kind="ghost" onClick={() => go("home")}>Later</Btn>
        <Btn onClick={() => go("chat")}>Look again with {tutorName}</Btn>
      </div>
      <button className="a-link" onClick={retry}>Replay this quiz</button>
    </main>
  );
}

/* ---------- 7 Goal met ---------- */
function GoalMet({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <main className="a-center screen-enter a-goalmet">
      <Confetti colors={["#58cc02", "#ffc800", "#1cb0f6", "#ff9600", "#ce82ff"]} />
      <div className="a-bounce"><OwlTutor size={140} mood="happy" /></div>
      <h1 className="a-h1 gold">Goal met!</h1>
      <p className="a-lead">You've got <b>Dividing a fraction by a fraction</b>. {tutorName} is impressed.</p>
      <div className="a-tiles">
        <div className="a-tile gold"><header>Goals met</header><b><Ic.Star size={22} /> {goalsMet + 1}</b></div>
        <div className="a-tile orange"><header>Streak</header><b><Ic.Flame size={22} /> {streak.days}</b></div>
        <div className="a-tile green"><header>Quiz</header><b><Ic.Check size={22} strokeWidth={3} /> 3/3</b></div>
      </div>
      <div className="a-card a-next">
        <small className="a-kicker">Up next in Math</small>
        <h3 className="a-goal-title">{nextUp.title}</h3>
        <span className="a-muted">Due {shortDate(nextUp.targetDate)}</span>
      </div>
      <div className="a-row">
        <Btn kind="ghost" onClick={() => go("home")}>Home</Btn>
        <Btn onClick={() => go("chat")}>Keep going</Btn>
      </div>
    </main>
  );
}

/* ---------- 8 Parent area (calmer) ---------- */
function ParentGoals({ go }: { go: (s: ScreenId) => void }) {
  const [learnerId, setLearnerId] = useState(1);
  const L = parentLearners.find((l) => l.id === learnerId)!;
  const bySubject = groupBy(parentGoals, (g) => g.subjectName);
  return (
    <div className="a-parent">
      <nav className="a-rail calm">
        <div className="a-logo">home<b>tutor</b> <small>Parent</small></div>
        <button className="on"><Ic.User size={22} /> <span>Learners</span></button>
        <button><Ic.Book size={22} /> <span>Curricula</span></button>
        <button><Ic.Settings size={22} /> <span>Settings</span></button>
        <button onClick={() => go("profiles")}><Ic.Back size={22} /> <span>Log out</span></button>
      </nav>
      <main className="a-parent-main screen-enter">
        <div className="a-tabs">
          {parentLearners.map((l) => (
            <button key={l.id} className={l.id === learnerId ? "on" : ""} onClick={() => setLearnerId(l.id)}>
              <Avatar id={l.avatar} color={l.color} name={l.name} size={28} /> {l.name}
            </button>
          ))}
        </div>
        <header className="a-parent-head">
          <Avatar id={L.avatar} color={L.color} name={L.name} size={56} />
          <div><h1 className="a-h2">{L.name}</h1><span className="a-muted">Grade {L.grade} · North Colonie Grade 6</span></div>
          <div className="a-parent-stats">
            <span><Ic.Flame size={16} /> {L.streak}-day streak</span>
            <span><Ic.Star size={16} /> {L.met} met</span>
            <span className="warn">{L.overdue} overdue</span>
            <span className="flag">{L.flagged} flagged</span>
          </div>
          <button className="a-btn a-btn-white small">Add Goal</button>
        </header>
        {Object.entries(bySubject).map(([subject, goals]) => (
          <section key={subject} className="a-pcard">
            <h2 className="a-h3">{subject}</h2>
            <table className="a-table">
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id} className={g.status}>
                    <td className="key">{g.kind === "unit-test" ? `Unit ${g.lessonKey}` : g.lessonKey}</td>
                    <td>{g.kind === "unit-test" ? `Unit Test: ${g.title}` : g.title}</td>
                    <td className="date">{shortDate(g.targetDate)}</td>
                    <td>
                      <span className={`a-pill ${g.status}`}>{g.status === "flagged" ? "Needs you" : g.status[0]!.toUpperCase() + g.status.slice(1)}</span>
                      {g.overdue && <span className="a-pill overdue">{daysLate(g.targetDate, today)} days late</span>}
                    </td>
                    <td className="act">{g.status === "flagged" ? <button className="a-btn a-btn-white small">Review</button> : <button className="a-icon-btn"><Ic.Dots /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );
}
