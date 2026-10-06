// PROTOTYPE (throwaway) — Direction B, "Studio": close to Brilliant.org.
// Paper-white canvas, ink-black actions, sentence case, a top bar instead of a rail, one "Continue" hero,
// list rows rather than cards, a timeline Path, document-style chat, inline quiz feedback.
import { useState } from "react";
import { MathText } from "../../../src/client/MathText";
import {
  ACCENTS, AVATARS, elaPath, goalsMet, groupBy, me, missedObjectives, nextUp, parentGoals, parentLearners, profiles, quizQuestions,
  session, shortDate, streak, subjects, today, type AvatarId, type PathState,
} from "../data";
import { Avatar, Confetti, OrbTutor } from "../shared/art";
import { daysLate, useQuiz, useStream, type ScreenId, type VariantProps } from "../shared/hooks";
import * as Ic from "../shared/icons";
import "./b.css";

const SUBJECT_COLOR: Record<string, string> = { math: "#3b6cf6", ela: "#e5484d", social: "#8e4ec6", science: "#12a594" };

export function VariantB({ screen, tutorName, go }: VariantProps) {
  return (
    <div className="vb">
      {screen === "profiles" && <Profiles go={go} />}
      {screen === "avatar" && <AvatarPick go={go} tutorName={tutorName} />}
      {screen === "home" && <Top go={go} tab="home"><Home go={go} tutorName={tutorName} /></Top>}
      {screen === "path" && <Top go={go} tab="path"><LearningPath go={go} /></Top>}
      {screen === "chat" && <Chat go={go} tutorName={tutorName} />}
      {screen.startsWith("quiz") && <QuizScreen screen={screen} go={go} tutorName={tutorName} />}
      {screen === "goal-met" && <GoalMet go={go} tutorName={tutorName} />}
      {screen === "parent" && <ParentGoals go={go} />}
    </div>
  );
}

function Btn({ kind = "ink", children, onClick, disabled }: { kind?: "ink" | "line" | "soft" | "warm"; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button className={`b-btn b-btn-${kind}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Meter({ value, total, color = "var(--ink)" }: { value: number; total: number; color?: string }) {
  return <div className="b-meter"><span style={{ width: `${(value / total) * 100}%`, background: color }} /></div>;
}

/* ---------- 1 Profile picker ---------- */
function Profiles({ go }: { go: (s: ScreenId) => void }) {
  return (
    <main className="b-split screen-enter">
      <section className="b-split-left">
        <div className="b-wordmark"><OrbTutor size={36} /> Home Tutor</div>
        <h1 className="b-display">Who's learning?</h1>
        <p className="b-sub">Tap your name to pick up where you left off.</p>
      </section>
      <section className="b-split-right">
        {profiles.map((p) => (
          <button key={p.id} className="b-profile" onClick={() => go(p.avatar ? "home" : "avatar")}>
            <Avatar id={p.avatar} color={p.color} name={p.name} size={64} shape="squircle" />
            <span className="b-profile-name">{p.name}</span>
            {p.hasPin ? <span className="b-muted b-inline"><Ic.Lock size={16} /> PIN</span> : <Ic.Arrow size={20} />}
          </button>
        ))}
        <button className="b-text-btn" onClick={() => go("parent")}>Parent area <Ic.Arrow size={16} /></button>
      </section>
    </main>
  );
}

/* ---------- 2 Avatar pick ---------- */
function AvatarPick({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const [pick, setPick] = useState<AvatarId | null>(null);
  const [color, setColor] = useState("#5b6cff");
  return (
    <main className="b-split screen-enter">
      <section className="b-split-left">
        <div className="b-wordmark"><OrbTutor size={36} mood="happy" /> {tutorName}</div>
        <span className="b-eyebrow">Set up · 1 of 1</span>
        <h1 className="b-display">Make it yours, Leo.</h1>
        <p className="b-sub">Pick a picture and a colour. You can ask your Parent to change it later.</p>
        <div className="b-namecard">
          <Avatar id={pick} color={color} name="Leo" size={88} shape="squircle" />
          <div><b>Leo</b><span className="b-muted">Grade 4</span></div>
        </div>
      </section>
      <section className="b-split-right wide">
        <h2 className="b-h3">Picture</h2>
        <div className="b-avatar-grid">
          {AVATARS.map((id) => (
            <button key={id} className={`b-avatar-opt${pick === id ? " on" : ""}`} onClick={() => setPick(id)} aria-label={id}>
              <Avatar id={id} color={pick === id ? color : "#2a2d34"} name={id} size={52} shape="squircle" />
            </button>
          ))}
        </div>
        <h2 className="b-h3">Colour</h2>
        <div className="b-swatches">
          {ACCENTS.map((c) => (
            <button key={c} className={`b-swatch${color === c ? " on" : ""}`} onClick={() => setColor(c)} aria-label={c}><span style={{ background: c }} /></button>
          ))}
        </div>
        <div className="b-right"><Btn disabled={!pick} onClick={() => go("home")}>Done <Ic.Arrow size={18} /></Btn></div>
      </section>
    </main>
  );
}

/* ---------- Top bar ---------- */
function Top({ go, tab, children }: { go: (s: ScreenId) => void; tab: "home" | "path"; children: React.ReactNode }) {
  return (
    <div className="b-app">
      <header className="b-top">
        <div className="b-wordmark small"><OrbTutor size={28} /> Home Tutor</div>
        <nav className="b-nav">
          <button className={tab === "home" ? "on" : ""} onClick={() => go("home")}>Today</button>
          <button className={tab === "path" ? "on" : ""} onClick={() => go("path")}>Learning Path</button>
        </nav>
        <div className="b-top-right">
          <span className="b-streak-chip" title="Streak"><Ic.Flame size={18} /> {streak.days}</span>
          <button className="b-me" onClick={() => go("profiles")}><Avatar id={me.avatar} color={me.color} name={me.name} size={34} shape="squircle" /></button>
        </div>
      </header>
      <main className="b-page screen-enter">{children}</main>
    </div>
  );
}

/* ---------- 3 Home ---------- */
function Home({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const hero = subjects[0]!;
  return (
    <>
      <h1 className="b-h1">Good afternoon, {me.name}</h1>
      <div className="b-home-grid">
        <section className="b-hero">
          <div className="b-hero-art"><OrbTutor size={120} /><div className="b-hero-shape" /></div>
          <div className="b-hero-body">
            <span className="b-eyebrow">{hero.name} · {hero.where}</span>
            <h2 className="b-h2">{hero.card!.title}</h2>
            <p className="b-catch"><Ic.Clock size={16} /> This one's been waiting since {shortDate(hero.card!.targetDate)}. Let's catch up.</p>
            <div className="b-hero-foot">
              <Btn onClick={() => go("chat")}>Continue with {tutorName} <Ic.Arrow size={18} /></Btn>
              <span className="b-muted">About 20 min</span>
            </div>
          </div>
        </section>
        <aside className="b-week">
          <div className="b-week-head"><span className="b-eyebrow">Streak</span><b>{streak.days} days</b></div>
          <div className="b-week-days">
            {streak.week.map((d, i) => (
              <div key={i} className={`b-wd ${d.state}`}><span /><small>{d.label}</small></div>
            ))}
          </div>
          <p className="b-muted small">Weekends count, but never break it.</p>
          <hr />
          <div className="b-week-head"><span className="b-eyebrow">Goals met</span><b>{goalsMet}</b></div>
        </aside>
      </div>
      <h2 className="b-h3 b-section">All subjects</h2>
      <div className="b-rows">
        {subjects.map((s) => {
          const Icon = Ic.SUBJECT_ICON[s.key]!;
          return (
            <div key={s.key} className={`b-row${s.withParent ? " muted" : ""}`}>
              <span className="b-row-icon" style={{ color: SUBJECT_COLOR[s.key], background: `color-mix(in srgb, ${SUBJECT_COLOR[s.key]} 12%, #fff)` }}><Icon size={22} /></span>
              <button className="b-row-subject" onClick={() => go("path")}>{s.name}</button>
              <span className="b-row-title">
                {s.withParent ? <span className="b-inline"><Ic.Parent size={18} /> With your Parent for now</span> : (s.card!.kind === "unit-test" ? `Unit Test · ${s.card!.title}` : s.card!.title)}
                {s.card?.overdue && <span className="b-tag warm">Catch up</span>}
              </span>
              <span className="b-row-meter"><Meter value={s.met} total={s.total} color={SUBJECT_COLOR[s.key]} /><small>{s.met}/{s.total}</small></span>
              {s.withParent ? <span /> : <Btn kind="line" onClick={() => go("chat")}>Start</Btn>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- 4 Learning Path ---------- */
const STATE_TEXT: Record<PathState, string> = { met: "Done", current: "Up next", skipped: "Skipped", "with-parent": "With your Parent", ahead: "" };

function LearningPath({ go }: { go: (s: ScreenId) => void }) {
  const all = elaPath.units.flatMap((u) => u.nodes);
  const met = all.filter((n) => n.state === "met").length;
  return (
    <div className="b-path">
      <aside className="b-path-side">
        <button className="b-text-btn" onClick={() => go("home")}><Ic.Back size={16} /> Today</button>
        <span className="b-eyebrow">{elaPath.term}</span>
        <h1 className="b-h1">{elaPath.subject}</h1>
        <div className="b-ring" style={{ "--p": met / all.length } as React.CSSProperties}><b>{met}</b><small>of {all.length}</small></div>
        <ul className="b-legend">
          <li><i className="met" /> Done</li><li><i className="current" /> Up next</li><li><i className="skipped" /> Skipped</li>
          <li><i className="with-parent" /> With your Parent</li><li><i className="ahead" /> Later</li>
        </ul>
      </aside>
      <div className="b-timeline">
        {elaPath.units.map((u) => (
          <section key={u.key} className="b-tl-unit">
            <header><span className="b-eyebrow">Unit {u.key}</span><h2 className="b-h3">{u.title}</h2></header>
            <ol>
              {u.nodes.map((n) => (
                <li key={n.key + n.kind} className={`b-tl ${n.state} ${n.kind}`}>
                  <span className="b-tl-dot">
                    {n.state === "met" && <Ic.Check size={14} strokeWidth={3.4} />}
                    {n.state === "with-parent" && <Ic.Parent size={14} />}
                    {n.state === "skipped" && <Ic.Skip size={12} />}
                    {n.kind === "unit-test" && n.state === "ahead" && <Ic.Trophy size={14} />}
                  </span>
                  <div className="b-tl-text">
                    <small>{n.kind === "unit-test" ? "Unit Test" : `Lesson ${n.key}`}</small>
                    <b>{n.kind === "unit-test" ? u.title : n.title}</b>
                  </div>
                  {n.state === "current" ? <Btn onClick={() => go("chat")}>Start</Btn> : <span className="b-tl-state">{STATE_TEXT[n.state]}</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- 5 Session chat ---------- */
function Chat({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const s = useStream();
  const [breakOpen, setBreakOpen] = useState(true);
  return (
    <div className="b-chat-app screen-enter">
      <aside className="b-lesson">
        <button className="b-text-btn" onClick={() => go("home")}><Ic.Back size={16} /> Leave</button>
        <span className="b-eyebrow">{session.subjectName} · Lesson 3.2</span>
        <h1 className="b-h2">{session.title}</h1>
        <ol className="b-steps">
          <li className="done"><span><Ic.Check size={12} strokeWidth={3.5} /></span>Explanation</li>
          <li className="on"><span>2</span>Check you've got it</li>
          <li><span>3</span>Lesson Quiz</li>
        </ol>
        <div className="b-objectives">
          <span className="b-eyebrow">You'll be able to</span>
          <ul>
            <li>Divide by a unit fraction</li>
            <li>Divide a fraction by a fraction</li>
            <li>Explain why dividing by a fraction less than 1 makes a bigger number</li>
          </ul>
        </div>
      </aside>
      <section className="b-convo">
        <div className="b-convo-scroll">
          {session.messages.map((m, i) => (
            m.role === "tutor" ? (
              <article key={i} className="b-t"><header><OrbTutor size={28} /> {tutorName}</header><p><MathText text={m.content} /></p></article>
            ) : (
              <p key={i} className="b-me">{m.content}</p>
            )
          ))}
          <article className="b-t">
            <header><OrbTutor size={28} mood={s.done ? "idle" : "thinking"} /> {tutorName} {!s.done && <span className="b-muted small">is writing…</span>}</header>
            <p className={s.done ? "" : "caret"}><MathText text={s.text} /></p>
          </article>
          {s.done && breakOpen && (
            <div className="b-break screen-enter">
              <Ic.Coffee size={22} />
              <div><b>{session.breakMinutes} minutes in. Time for a short break?</b><span className="b-muted">Stretch, get a drink, then come back. Your place is saved.</span></div>
              <Btn kind="soft" onClick={() => setBreakOpen(false)}>Keep going</Btn>
              <Btn onClick={() => go("home")}>Take a break</Btn>
            </div>
          )}
        </div>
        <footer className="b-composer">
          <input placeholder="Write your answer…" />
          <button className="b-send" onClick={() => go("quiz")} aria-label="Send"><Ic.Send size={20} /></button>
        </footer>
      </section>
    </div>
  );
}

/* ---------- 6 Quiz ---------- */
function QuizScreen({ screen, go, tutorName }: { screen: ScreenId; go: (s: ScreenId) => void; tutorName: string }) {
  const q = useQuiz(screen);
  if (q.done) return <QuizScore go={go} tutorName={tutorName} retry={q.retry} results={q.results} />;
  const question = q.question!;
  const fb = q.feedback;
  return (
    <div className="b-quiz-app screen-enter">
      <header className="b-quiz-top">
        <button className="b-text-btn" onClick={() => go("home")}><Ic.Close size={18} /> Leave</button>
        <span className="b-muted">Lesson Quiz · Dividing a fraction by a fraction · attempt 1 of 3</span>
        <div className="b-segs">{quizQuestions.map((_, i) => <span key={i} className={i < q.index || (i === q.index && fb) ? (q.results[i] ?? fb?.correct ? "done" : "miss") : i === q.index ? "on" : ""} />)}</div>
      </header>
      <main className="b-qcard">
        <span className="b-eyebrow">Question {q.index + 1} of {q.total}</span>
        <h1 className="b-qprompt"><MathText text={question.prompt} /></h1>
        {question.type === "multiple-choice" && (
          <div className="b-options">
            {question.choices.map((c) => {
              const picked = q.draft === c;
              const state = fb ? (c === fb.correctAnswer ? "right" : picked ? "wrong" : "dim") : picked ? "on" : "";
              return (
                <button key={c} className={`b-option ${state}`} onClick={() => q.setDraft(c)}>
                  <span className="b-radio" /> <MathText text={c} />
                </button>
              );
            })}
          </div>
        )}
        {question.type === "number" && (
          <label className="b-num"><input inputMode="decimal" value={q.draft} onChange={(e) => q.setDraft(e.target.value)} placeholder="0" /><span>scoops</span></label>
        )}
        {question.type === "short-answer" && (
          <textarea className="b-text" rows={4} value={q.draft} onChange={(e) => q.setDraft(e.target.value)} placeholder="Explain in a sentence or two" />
        )}
        {fb && (
          <div className={`b-fb ${fb.correct ? "right" : "wrong"}`}>
            <span className="b-fb-mark">{fb.correct ? <Ic.Check size={18} strokeWidth={3.4} /> : <Ic.Sparkle size={18} />}</span>
            <div>
              <b>{fb.correct ? "Correct." : "Not quite."}</b> <MathText text={fb.explanation} />
              {!fb.correct && <div className="b-muted small">Answer: <MathText text={fb.correctAnswer} /></div>}
            </div>
          </div>
        )}
        <footer className="b-qfoot">
          {fb ? <Btn onClick={q.next}>Continue <Ic.Arrow size={18} /></Btn> : <Btn disabled={!q.draft.trim()} onClick={q.check}>Check</Btn>}
        </footer>
      </main>
    </div>
  );
}

function QuizScore({ go, tutorName, retry, results }: { go: (s: ScreenId) => void; tutorName: string; retry: () => void; results: boolean[] }) {
  const right = results.filter(Boolean).length;
  return (
    <div className="b-quiz-app screen-enter">
      <header className="b-quiz-top"><button className="b-text-btn" onClick={() => go("home")}><Ic.Close size={18} /> Leave</button></header>
      <main className="b-score">
        <section>
          <span className="b-eyebrow">Attempt 1 of 3</span>
          <div className="b-score-num">{right}<span>/{results.length}</span></div>
          <ol className="b-score-list">
            {quizQuestions.map((qq, i) => (
              <li key={qq.id} className={results[i] ? "right" : "wrong"}>
                <span>{results[i] ? <Ic.Check size={14} strokeWidth={3.4} /> : <Ic.Close size={14} strokeWidth={3} />}</span>
                <MathText text={qq.prompt} />
              </li>
            ))}
          </ol>
        </section>
        <section className="b-score-next">
          <OrbTutor size={56} />
          <h1 className="b-h2">Let's look again at the parts you missed.</h1>
          <ul className="b-missed">{missedObjectives.map((o) => <li key={o}><Ic.Arrow size={16} /> {o}</li>)}</ul>
          <p className="b-muted">{tutorName} will walk through these, then you'll get a fresh attempt.</p>
          <div className="b-inline gap"><Btn onClick={() => go("chat")}>Go over it with {tutorName}</Btn><Btn kind="line" onClick={retry}>Replay quiz</Btn></div>
        </section>
      </main>
    </div>
  );
}

/* ---------- 7 Goal met ---------- */
function GoalMet({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <main className="b-met screen-enter">
      <Confetti colors={["#16181d", "#ffd23f", "#3b6cf6", "#ff7a1a"]} />
      <svg className="b-met-check" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e8e6df" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="#16181d" strokeWidth="8" strokeLinecap="round" className="ring" />
        <path d="M38 62 l15 15 l30 -32" fill="none" stroke="#16181d" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" className="tick" />
      </svg>
      <span className="b-eyebrow">Goal met · Math · Lesson 3.2</span>
      <h1 className="b-display center">Dividing a fraction by a fraction</h1>
      <p className="b-sub center">3 of 3 on the Lesson Quiz. {tutorName}: "That last explanation was spot on."</p>
      <div className="b-met-stats">
        <div><small>Goals met</small><b><Ic.Star size={18} /> {goalsMet + 1}</b></div>
        <div><small>Streak</small><b><Ic.Flame size={18} /> {streak.days} days</b></div>
        <div><small>Math this term</small><b>9/16</b></div>
      </div>
      <div className="b-next">
        <div><span className="b-eyebrow">Up next</span><b>{nextUp.title}</b><span className="b-muted">Math · due {shortDate(nextUp.targetDate)}</span></div>
        <Btn onClick={() => go("chat")}>Start <Ic.Arrow size={18} /></Btn>
      </div>
      <button className="b-text-btn" onClick={() => go("home")}>Back to Today</button>
    </main>
  );
}

/* ---------- 8 Parent ---------- */
function ParentGoals({ go }: { go: (s: ScreenId) => void }) {
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const goals = filter === "all" ? parentGoals : parentGoals.filter((g) => g.overdue || g.status === "flagged");
  const by = groupBy(goals, (g) => g.subjectName);
  const L = parentLearners[0]!;
  return (
    <div className="b-app parent">
      <header className="b-top">
        <div className="b-wordmark small"><OrbTutor size={28} /> Home Tutor <span className="b-tag">Parent</span></div>
        <nav className="b-nav"><button className="on">Learners</button><button>Curricula</button><button>Usage</button><button>Settings</button></nav>
        <div className="b-top-right"><button className="b-text-btn" onClick={() => go("profiles")}>Log out</button></div>
      </header>
      <div className="b-parent">
        <aside className="b-learners">
          {parentLearners.map((l) => (
            <button key={l.id} className={l.id === 1 ? "on" : ""}>
              <Avatar id={l.avatar} color={l.color} name={l.name} size={36} shape="squircle" />
              <span><b>{l.name}</b><small>Grade {l.grade}</small></span>
              {l.overdue + l.flagged > 0 && <span className="b-dot-count">{l.overdue + l.flagged}</span>}
            </button>
          ))}
        </aside>
        <main className="b-parent-main screen-enter">
          <div className="b-parent-head">
            <div><h1 className="b-h2">{L.name}'s Goals</h1><span className="b-muted">North Colonie Grade 6 · {L.streak}-day streak · {L.met} met</span></div>
            <div className="b-seg">
              <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
              <button className={filter === "attention" ? "on" : ""} onClick={() => setFilter("attention")}>Needs attention · 2</button>
            </div>
            <Btn>Add Goal</Btn>
          </div>
          <table className="b-table">
            <thead><tr><th>Lesson</th><th>Goal</th><th>Target</th><th>Status</th><th /></tr></thead>
            {Object.entries(by).map(([subject, gs]) => (
              <tbody key={subject}>
                <tr className="b-group"><td colSpan={5}>{subject}</td></tr>
                {gs.map((g) => (
                  <tr key={g.id} className={g.status}>
                    <td className="key">{g.kind === "unit-test" ? `U${g.lessonKey}` : g.lessonKey}</td>
                    <td>{g.kind === "unit-test" ? `Unit Test · ${g.title}` : g.title}</td>
                    <td className={g.overdue ? "late" : ""}>{shortDate(g.targetDate)}{g.overdue && <small> · {daysLate(g.targetDate, today)}d late</small>}</td>
                    <td><span className={`b-status ${g.status}`}>{g.status === "flagged" ? "Flagged" : g.status[0]!.toUpperCase() + g.status.slice(1)}</span></td>
                    <td className="act">{g.status === "flagged" ? <Btn kind="line">Review</Btn> : <button className="b-icon"><Ic.Dots /></button>}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </main>
      </div>
    </div>
  );
}
