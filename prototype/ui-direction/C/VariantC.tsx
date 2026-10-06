// PROTOTYPE (throwaway) — Direction C, "Bright": between A and B.
// Soft colour washes per Subject, sentence-case chunky-but-lower buttons, big Subject tiles in a grid,
// Units as horizontal tracks, a modal break prompt, colour-tile choices and an on-screen number pad.
import { useState } from "react";
import { MathText } from "../../../src/client/MathText";
import {
  ACCENTS, AVATARS, elaPath, goalsMet, groupBy, me, missedObjectives, nextUp, parentGoals, parentLearners, profiles, session,
  shortDate, streak, subjects, today, type AvatarId, type PathNode,
} from "../data";
import { Avatar, BotTutor, Confetti, type Mood } from "../shared/art";
import { daysLate, useQuiz, useStream, type Quiz, type ScreenId, type VariantProps } from "../shared/hooks";
import * as Ic from "../shared/icons";
import "./c.css";

const SUBJECT_COLOR: Record<string, string> = { math: "#2f9cf4", ela: "#f2557a", social: "#17b3a3", science: "#9b5de5" };
const tint = (key: string) => ({ "--s": SUBJECT_COLOR[key] }) as React.CSSProperties;

export function VariantC({ screen, tutorName, go }: VariantProps) {
  return (
    <div className="vc">
      {screen === "profiles" && <Profiles go={go} tutorName={tutorName} />}
      {screen === "avatar" && <AvatarPick go={go} tutorName={tutorName} />}
      {screen === "home" && <Home go={go} tutorName={tutorName} />}
      {screen === "path" && <LearningPath go={go} />}
      {screen === "chat" && <Chat go={go} tutorName={tutorName} />}
      {screen.startsWith("quiz") && <QuizScreen screen={screen} go={go} tutorName={tutorName} />}
      {screen === "goal-met" && <GoalMet go={go} tutorName={tutorName} />}
      {screen === "parent" && <ParentGoals go={go} />}
    </div>
  );
}

function Btn({ kind = "primary", children, onClick, disabled, big }: { kind?: "primary" | "white" | "soft" | "coral" | "green"; children: React.ReactNode; onClick?: () => void; disabled?: boolean; big?: boolean }) {
  return <button className={`c-btn c-btn-${kind}${big ? " big" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Pill({ value, total }: { value: number; total: number }) {
  return <div className="c-pill"><span style={{ width: `${Math.max(6, (value / total) * 100)}%` }} /></div>;
}

/* ---------- 1 Profile picker ---------- */
function Profiles({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <main className="c-profiles screen-enter">
      <div className="c-hi"><BotTutor size={72} mood="happy" /><div><small>{tutorName} here.</small><h1>Who's learning today?</h1></div></div>
      <div className="c-profile-row">
        {profiles.map((p) => (
          <button key={p.id} className="c-profile" style={{ "--a": p.color } as React.CSSProperties} onClick={() => go(p.avatar ? "home" : "avatar")}>
            <Avatar id={p.avatar} color={p.color} name={p.name} size={104} shape="squircle" />
            <b>{p.name}</b>
            {p.hasPin ? <span className="c-chip"><Ic.Lock size={14} /> PIN</span> : p.avatar ? <span className="c-chip ghost">Tap to start</span> : <span className="c-chip ghost">New here</span>}
          </button>
        ))}
      </div>
      <button className="c-link" onClick={() => go("parent")}><Ic.Parent size={18} /> I'm a Parent</button>
    </main>
  );
}

/* ---------- 2 Avatar pick ---------- */
function AvatarPick({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const [pick, setPick] = useState<AvatarId | null>("owl");
  const [color, setColor] = useState<string>(ACCENTS[3]);
  const [tab, setTab] = useState<"picture" | "colour">("picture");
  return (
    <main className="c-avatar screen-enter">
      <div className="c-idcard" style={{ "--a": color } as React.CSSProperties}>
        <div className="c-id-pic c-pop" key={`${pick}${color}`}><Avatar id={pick} color={color} name="Leo" size={120} shape="squircle" /></div>
        <div><small>Learner</small><b>Leo</b><span>Grade 4 · Home Tutor</span></div>
      </div>
      <p className="c-say"><BotTutor size={40} /> Make your card, Leo. {tutorName} will use it to say hi.</p>
      <section className="c-panel">
        <div className="c-tabs">
          <button className={tab === "picture" ? "on" : ""} onClick={() => setTab("picture")}>Picture</button>
          <button className={tab === "colour" ? "on" : ""} onClick={() => setTab("colour")}>Colour</button>
        </div>
        {tab === "picture" ? (
          <div className="c-avatar-grid">
            {AVATARS.map((id) => (
              <button key={id} className={`c-avatar-opt${pick === id ? " on" : ""}`} onClick={() => setPick(id)} aria-label={id}>
                <Avatar id={id} color={color} name={id} size={60} shape="squircle" />
              </button>
            ))}
          </div>
        ) : (
          <div className="c-colours">
            {ACCENTS.map((c) => (
              <button key={c} className={`c-colour${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c}>
                {color === c && <Ic.Check size={26} strokeWidth={3.4} />}
              </button>
            ))}
          </div>
        )}
        <div className="c-panel-foot">
          {tab === "picture" ? <Btn onClick={() => setTab("colour")}>Next: colour <Ic.Arrow size={18} /></Btn> : <Btn onClick={() => go("home")}>That's me <Ic.Check size={18} strokeWidth={3} /></Btn>}
        </div>
      </section>
    </main>
  );
}

/* ---------- Header used by home + path ---------- */
function Header({ go, tab }: { go: (s: ScreenId) => void; tab: "home" | "path" }) {
  return (
    <header className="c-header">
      <button className="c-me" onClick={() => go("profiles")}><Avatar id={me.avatar} color={me.color} name={me.name} size={44} shape="squircle" /></button>
      <nav className="c-seg">
        <button className={tab === "home" ? "on" : ""} onClick={() => go("home")}><Ic.Home size={18} /> Home</button>
        <button className={tab === "path" ? "on" : ""} onClick={() => go("path")}><Ic.PathIcon size={18} /> Paths</button>
      </nav>
      <div className="c-header-stats">
        <span className="c-stat streak"><Ic.Flame size={20} /> <b>{streak.days}</b><small>day streak</small></span>
        <span className="c-stat gold"><Ic.Star size={20} /> <b>{goalsMet}</b><small>Goals met</small></span>
      </div>
    </header>
  );
}

/* ---------- 3 Home ---------- */
function Home({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <div className="c-page">
      <Header go={go} tab="home" />
      <main className="screen-enter">
        <h1 className="c-h1">Hey {me.name}! Here's what's on.</h1>
        <div className="c-tiles">
          {subjects.map((s) => {
            const Icon = Ic.SUBJECT_ICON[s.key]!;
            return (
              <section key={s.key} className={`c-tile${s.withParent ? " parent" : ""}`} style={tint(s.key)}>
                <span className="c-tile-mark"><Icon size={120} strokeWidth={1.4} /></span>
                {s.card?.overdue && <span className="c-sticker"><Ic.Clock size={16} /> Let's catch up</span>}
                <button className="c-tile-subject" onClick={() => go("path")}><span className="c-tile-icon"><Icon size={20} /></span> {s.name} <Ic.Arrow size={14} /></button>
                {s.withParent ? (
                  <>
                    <h2 className="c-tile-title">With your Parent</h2>
                    <p className="c-tile-note"><Ic.Parent size={18} /> Your Parent is choosing what's next here. Nothing for you to do yet.</p>
                  </>
                ) : (
                  <>
                    <small className="c-tile-where">{s.card!.kind === "unit-test" ? "Unit Test" : s.where}</small>
                    <h2 className="c-tile-title">{s.card!.title}</h2>
                    {s.card!.overdue && <p className="c-tile-note warm">It's been waiting since {shortDate(s.card!.targetDate)}. No stress, pick it up now.</p>}
                  </>
                )}
                <div className="c-tile-foot">
                  <div className="c-tile-progress"><Pill value={s.met} total={s.total} /><small>{s.met} of {s.total} this term</small></div>
                  {!s.withParent && <Btn kind="white" onClick={() => go("chat")}>Start</Btn>}
                </div>
              </section>
            );
          })}
        </div>
        <div className="c-tip"><BotTutor size={48} /> <span><b>{tutorName}:</b> Math first? It's been waiting the longest.</span></div>
      </main>
    </div>
  );
}

/* ---------- 4 Learning Path ---------- */
function LearningPath({ go }: { go: (s: ScreenId) => void }) {
  return (
    <div className="c-page">
      <Header go={go} tab="path" />
      <main className="screen-enter" style={tint("ela")}>
        <div className="c-path-head">
          <span className="c-tile-icon big"><Ic.Book size={28} /></span>
          <div><small>{elaPath.term}</small><h1 className="c-h1">{elaPath.subject} Learning Path</h1></div>
          <div className="c-legend">
            <span className="met">Done</span><span className="current">Up next</span><span className="skipped">Skipped</span><span className="with-parent">With your Parent</span><span className="ahead">Later</span>
          </div>
        </div>
        {elaPath.units.map((u) => (
          <section key={u.key} className="c-track">
            <h2 className="c-track-title"><span>Unit {u.key}</span> {u.title}</h2>
            <div className="c-track-row">
              {u.nodes.map((n) => <Stop key={n.key + n.kind} n={n} go={go} />)}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function Stop({ n, go }: { n: PathNode; go: (s: ScreenId) => void }) {
  const icon = {
    met: <Ic.Check size={30} strokeWidth={3.2} />,
    current: n.kind === "unit-test" ? <Ic.Trophy size={30} /> : <Ic.Star size={30} />,
    skipped: <Ic.Skip size={24} />,
    "with-parent": <Ic.Parent size={26} />,
    ahead: n.kind === "unit-test" ? <Ic.Trophy size={28} /> : <span className="c-num">{n.key}</span>,
  }[n.state];
  return (
    <div className={`c-stop ${n.state} ${n.kind}`}>
      <button className="c-stop-tile" disabled={n.state !== "current"} onClick={() => go("chat")} aria-label={`${n.title}: ${n.state}`}>{icon}</button>
      <b>{n.kind === "unit-test" ? "Unit Test" : n.title}</b>
      <small>{n.state === "met" ? "Done" : n.state === "skipped" ? "Skipped" : n.state === "with-parent" ? "With your Parent" : n.state === "current" ? "" : n.kind === "unit-test" ? "End of unit" : `Lesson ${n.key}`}</small>
      {n.state === "current" && <Btn onClick={() => go("chat")}>Start</Btn>}
    </div>
  );
}

/* ---------- 5 Session chat ---------- */
function Chat({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  const s = useStream();
  const [dismissed, setDismissed] = useState(false);
  return (
    <div className="c-chat screen-enter" style={tint("math")}>
      <header className="c-chat-band">
        <button className="c-round" onClick={() => go("home")} aria-label="Leave"><Ic.Back size={20} /></button>
        <div><small>Math · Lesson 3.2</small><h1>{session.title}</h1></div>
        <ol className="c-dots"><li className="done">Learn</li><li className="on">Check</li><li>Quiz</li></ol>
      </header>
      <main className="c-chat-body">
        {session.messages.map((m, i) => (
          m.role === "tutor" ? (
            <div key={i} className="c-msg tutor"><BotTutor size={40} /><div className="c-bub"><MathText text={m.content} /></div></div>
          ) : (
            <div key={i} className="c-msg me"><div className="c-bub">{m.content}</div><Avatar id={me.avatar} color={me.color} name={me.name} size={36} shape="squircle" /></div>
          )
        ))}
        <div className="c-msg tutor">
          <BotTutor size={40} mood={s.done ? "idle" : "thinking"} />
          <div className={`c-bub${s.done ? "" : " caret"}`}><MathText text={s.text} /></div>
        </div>
      </main>
      <footer className="c-chat-foot">
        <div className="c-starters"><button>I'm not sure</button><button>Can you show another example?</button><button>Is it 4?</button></div>
        <div className="c-compose"><input placeholder={`Reply to ${tutorName}…`} /><Btn onClick={() => go("quiz")}><Ic.Send size={20} /></Btn></div>
      </footer>
      {s.done && !dismissed && (
        <div className="c-modal-wrap">
          <div className="c-modal c-pop">
            <BotTutor size={96} mood="rest" />
            <h2>Break time?</h2>
            <p>You've been working for {session.breakMinutes} minutes. Stretch, grab some water, then come back. Your spot is saved.</p>
            <div className="c-row"><Btn kind="soft" onClick={() => setDismissed(true)}>Keep going</Btn><Btn onClick={() => go("home")}><Ic.Coffee size={18} /> Take a break</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 6 Quiz ---------- */
const SHAPES = ["●", "▲", "■", "◆"];

function QuizScreen({ screen, go, tutorName }: { screen: ScreenId; go: (s: ScreenId) => void; tutorName: string }) {
  const q = useQuiz(screen);
  if (q.done) return <QuizScore go={go} tutorName={tutorName} retry={q.retry} results={q.results} />;
  const question = q.question!;
  const fb = q.feedback;
  const mood: Mood = fb?.correct ? "happy" : "idle";
  return (
    <div className="c-quiz screen-enter" style={tint("math")}>
      <header className="c-quiz-top">
        <button className="c-round" onClick={() => go("home")} aria-label="Leave"><Ic.Close size={20} /></button>
        <div className="c-qprog">{Array.from({ length: q.total }, (_, i) => (
          <span key={i} className={i < q.index ? (q.results[i] ? "right" : "wrong") : i === q.index ? (fb ? (fb.correct ? "right" : "wrong") : "on") : ""} />
        ))}</div>
        <small>Attempt 1 of 3</small>
      </header>
      <main className={`c-qbody ${question.type}`}>
        <div className="c-qhead">
          <BotTutor size={64} mood={mood} />
          <div><small>Question {q.index + 1} of {q.total}</small><h1><MathText text={question.prompt} /></h1></div>
        </div>
        {question.type === "multiple-choice" && (
          <div className="c-choices">
            {question.choices.map((c, i) => {
              const picked = q.draft === c;
              const state = fb ? (c === fb.correctAnswer ? "right" : picked ? "wrong" : "dim") : picked ? "on" : "";
              return (
                <button key={c} className={`c-choice k${i} ${state}`} onClick={() => q.setDraft(c)}>
                  <span className="c-shape">{SHAPES[i]}</span><MathText text={c} />
                </button>
              );
            })}
          </div>
        )}
        {question.type === "number" && <NumberPad q={q} />}
        {question.type === "short-answer" && (
          <div className="c-written">
            <textarea rows={4} value={q.draft} onChange={(e) => q.setDraft(e.target.value)} placeholder="Type your answer…" />
            {!fb && <div className="c-starters">{["Because…", "It's like…", "If you think of it as…"].map((t) => <button key={t} onClick={() => q.setDraft(q.draft + t + " ")}>{t}</button>)}</div>}
          </div>
        )}
      </main>
      {fb ? (
        <div className={`c-toast ${fb.correct ? "right" : "wrong"}`}>
          <span className={`c-toast-icon${fb.correct ? " c-pop" : ""}`}>{fb.correct ? <Ic.Check size={28} strokeWidth={3.4} /> : <Ic.Sparkle size={26} />}</span>
          <div>
            <b>{fb.correct ? "Yes! That's it." : "Not quite, but close."}</b>
            <p><MathText text={fb.explanation} /></p>
            {!fb.correct && <p className="c-answer">Answer: <MathText text={fb.correctAnswer} /></p>}
          </div>
          <Btn kind={fb.correct ? "green" : "coral"} onClick={q.next}>Next <Ic.Arrow size={18} /></Btn>
        </div>
      ) : (
        <div className="c-qfoot"><Btn big disabled={!q.draft.trim()} onClick={q.check}>Check answer</Btn></div>
      )}
    </div>
  );
}

function NumberPad({ q }: { q: Quiz }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
  const fb = q.feedback;
  return (
    <div className="c-numpad-wrap">
      <div className={`c-numdisplay${fb ? (fb.correct ? " right" : " wrong") : ""}`}>{q.draft || <span>?</span>}<small>scoops</small></div>
      <div className="c-numpad">
        {keys.map((k) => (
          <button key={k} disabled={!!fb} onClick={() => q.setDraft(k === "⌫" ? q.draft.slice(0, -1) : q.draft + k)}>{k}</button>
        ))}
      </div>
    </div>
  );
}

function QuizScore({ go, tutorName, retry, results }: { go: (s: ScreenId) => void; tutorName: string; retry: () => void; results: boolean[] }) {
  const right = results.filter(Boolean).length;
  return (
    <main className="c-score screen-enter" style={tint("math")}>
      <section className="c-score-card">
        <BotTutor size={88} mood="idle" />
        <small>Attempt 1 of 3</small>
        <h1>{right} out of {results.length}</h1>
        <div className="c-stickers">{results.map((r, i) => <span key={i} className={r ? "right" : "wrong"}>{r ? <Ic.Check size={22} strokeWidth={3.2} /> : `Q${i + 1}`}</span>)}</div>
        <p>Not this time, and that's fine. Let's look again at the parts you missed.</p>
      </section>
      <section className="c-missed">
        {missedObjectives.map((o, i) => (
          <div key={o} className="c-missed-card"><span>{i + 1}</span><b>{o}</b></div>
        ))}
        <div className="c-row"><Btn big onClick={() => go("chat")}>Go over it with {tutorName}</Btn></div>
        <div className="c-row"><button className="c-link" onClick={retry}>Replay quiz</button><button className="c-link" onClick={() => go("home")}>Do it later</button></div>
      </section>
    </main>
  );
}

/* ---------- 7 Goal met ---------- */
function GoalMet({ go, tutorName }: { go: (s: ScreenId) => void; tutorName: string }) {
  return (
    <main className="c-met" style={tint("math")}>
      <Confetti colors={["#fff", "#ffd23f", "#ff8a00", "#5ef0d0", "#ff9bb0"]} />
      <div className="c-met-hero c-pop"><BotTutor size={150} mood="happy" /></div>
      <h1>Goal met!</h1>
      <p className="c-met-lead">Dividing a fraction by a fraction, done. {tutorName} is doing a little robot dance.</p>
      <section className="c-met-card">
        <div className="c-met-stats">
          <span className="c-stat gold"><Ic.Star size={22} /> <b>{goalsMet + 1}</b><small>Goals met</small></span>
          <span className="c-stat streak"><Ic.Flame size={22} /> <b>{streak.days}</b><small>day streak</small></span>
          <span className="c-stat"><Ic.Check size={22} strokeWidth={3} /> <b>3/3</b><small>on the quiz</small></span>
        </div>
        <div className="c-up-next">
          <span className="c-tile-icon"><Ic.Calc size={20} /></span>
          <div><small>Up next in Math</small><b>{nextUp.title}</b></div>
          <Btn onClick={() => go("chat")}>Start</Btn>
        </div>
      </section>
      <button className="c-link light" onClick={() => go("home")}>Back home</button>
    </main>
  );
}

/* ---------- 8 Parent ---------- */
function ParentGoals({ go }: { go: (s: ScreenId) => void }) {
  const [id, setId] = useState(1);
  const L = parentLearners.find((l) => l.id === id)!;
  const by = groupBy(parentGoals, (g) => g.subjectKey);
  const attention = parentGoals.filter((g) => g.overdue || g.status === "flagged");
  return (
    <div className="c-parent">
      <header className="c-parent-top">
        <b className="c-brand"><BotTutor size={30} /> Home Tutor <span>Parent</span></b>
        <nav>{["Learners", "Curricula", "Usage", "Settings"].map((t, i) => <button key={t} className={i === 0 ? "on" : ""}>{t}</button>)}</nav>
        <button className="c-link" onClick={() => go("profiles")}>Log out</button>
      </header>
      <main className="c-parent-main screen-enter">
        <div className="c-learner-switch">
          {parentLearners.map((l) => (
            <button key={l.id} className={l.id === id ? "on" : ""} onClick={() => setId(l.id)}>
              <Avatar id={l.avatar} color={l.color} name={l.name} size={40} shape="squircle" />
              <span><b>{l.name}</b><small>Grade {l.grade} · {l.streak}-day streak</small></span>
            </button>
          ))}
        </div>
        <section className="c-attention">
          <h2><Ic.Flag size={18} /> Needs you ({attention.length})</h2>
          {attention.map((g) => (
            <div key={g.id} className="c-att-row">
              <span className="c-dot" style={{ background: SUBJECT_COLOR[g.subjectKey] }} />
              <span className="c-att-title"><b>{g.title}</b><small>{g.subjectName} · Lesson {g.lessonKey}</small></span>
              {g.status === "flagged" ? <span className="c-badge flag">Flagged after 3 attempts</span> : <span className="c-badge late">{daysLate(g.targetDate, today)} days overdue</span>}
              <Btn kind="soft">{g.status === "flagged" ? "Review" : "Move date"}</Btn>
            </div>
          ))}
        </section>
        <div className="c-subject-cols">
          {Object.entries(by).map(([key, gs]) => (
            <section key={key} className="c-scard" style={tint(key)}>
              <h3>{gs[0]!.subjectName}<small>{gs.filter((g) => g.status === "met").length} met</small></h3>
              <ol>
                {gs.map((g) => (
                  <li key={g.id} className={g.status}>
                    <span className="c-key">{g.kind === "unit-test" ? `U${g.lessonKey}` : g.lessonKey}</span>
                    <span className="c-gt">{g.kind === "unit-test" ? `Unit Test: ${g.title}` : g.title}</span>
                    <span className="c-gd">{g.status === "met" ? <Ic.Check size={16} strokeWidth={3} /> : g.status === "skipped" ? "Skipped" : g.status === "flagged" ? <span className="c-badge flag">Flagged</span> : shortDate(g.targetDate)}</span>
                  </li>
                ))}
              </ol>
              <button className="c-add">+ Add Goal</button>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
