import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, PIN_PATTERN } from "../shared/auth";
import type {
  CurriculumSummary,
  DailyUsage,
  Goal,
  GoalCard,
  Learner,
  LearnerInput,
  LessonOption,
  LlmSettings,
  LoggedInLearner,
  LearnerProfile,
  ParentStatus,
  QuizAttempt,
  SessionMessage,
  TeachingSettings,
  TutorSession,
} from "../shared/api";
import { MAX_QUIZ_ATTEMPTS_LIMIT, MAX_RE_EXPLANATIONS_LIMIT, TUTOR_STARTED_STEPS } from "../shared/api";
import { PROVIDERS, isProviderId, providerInfo } from "../shared/llm";
import { api } from "./api";
import { MathText } from "./MathText";
import { text } from "./text";

type AppState = { learner: LoggedInLearner } | { learner: undefined; parent: ParentStatus };

export function App() {
  const [state, setState] = useState<AppState>();
  const [parentLogin, setParentLogin] = useState(false);
  const [error, setError] = useState<string>();

  // A logged-in Learner can't reach any Parent endpoint, so ask who they are first.
  const refresh = async () => {
    try {
      const learner = await api.learnerMe();
      setState(learner ? { learner } : { learner: undefined, parent: await api.parentStatus() });
      setParentLogin(false);
    } catch {
      setError(text.genericError);
    }
  };
  useEffect(() => void refresh(), []);

  let content;
  if (error) content = <p className="error">{error}</p>;
  else if (!state) content = <p>{text.loading}</p>;
  else if (state.learner) content = <LearnerHome learner={state.learner} onLogout={refresh} />;
  else if (!state.parent.passwordSet) content = <SetupForm onDone={refresh} />;
  else if (state.parent.loggedIn) content = <ParentArea onLogout={refresh} />;
  else if (parentLogin) content = <LoginForm onDone={refresh} onBack={() => setParentLogin(false)} />;
  else content = <LearnerLogin onDone={refresh} onParent={() => setParentLogin(true)} />;

  return <main>{content}</main>;
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(text.setup.tooShort);
    if (password !== confirm) return setError(text.setup.mismatch);
    const res = await api.setupParent(password);
    if (res.ok || res.status === 409) onDone();
    else setError(res.status === 400 ? text.setup.tooShort : text.genericError);
  }

  return (
    <form onSubmit={submit}>
      <h1>{text.setup.heading}</h1>
      <p>{text.setup.intro}</p>
      <label>
        {text.setup.passwordLabel}
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label>
        {text.setup.confirmLabel}
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <span className="hint">{text.setup.hint}</span>
      {error && <p className="error">{error}</p>}
      <button type="submit">{text.setup.submit}</button>
    </form>
  );
}

function LoginForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await api.loginParent(password);
    if (res.ok) onDone();
    else setError(res.status === 401 ? text.login.wrongPassword : text.genericError);
  }

  return (
    <form onSubmit={submit}>
      <h1>{text.login.heading}</h1>
      <label>
        {text.login.passwordLabel}
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">{text.login.submit}</button>
      <button type="button" className="link" onClick={onBack}>
        {text.login.back}
      </button>
    </form>
  );
}

function ParentArea({ onLogout }: { onLogout: () => void }) {
  return (
    <section>
      <h1>{text.parentArea.heading}</h1>
      <Learners />
      <Curricula />
      <LlmSettingsForm />
      <TeachingSettingsForm />
      <Usage />
      <button type="button" onClick={() => api.logoutParent().then(onLogout)}>
        {text.parentArea.logout}
      </button>
    </section>
  );
}

function Curricula() {
  const [curricula, setCurricula] = useState<CurriculumSummary[]>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.curricula().then(setCurricula, () => setError(text.genericError)), []);

  if (error) return <p className="error">{error}</p>;
  if (!curricula) return <p>{text.loading}</p>;
  return (
    <section>
      <h2>{text.curricula.heading}</h2>
      {curricula.length === 0 && <p>{text.curricula.none}</p>}
      {curricula.map((curriculum) => (
        <article key={curriculum.id} className="curriculum">
          {curriculum.valid ? (
            <>
              <h3>{curriculum.title}</h3>
              <p className="hint">{text.curricula.details(curriculum.district, curriculum.grade, curriculum.schoolYear)}</p>
              <ul>
                {curriculum.subjects.map((s) => (
                  <li key={s.key}>{text.curricula.subject(s.name, s.lessonCount)}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3>{curriculum.id}</h3>
              <p className="error">{text.curricula.invalid(curriculum.errors.length)}</p>
              <ul className="errors">
                {curriculum.errors.map((e, i) => (
                  <li key={i}>
                    <code>{text.curricula.location(`${curriculum.id}/${e.file}`, e.line)}</code> {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      ))}
    </section>
  );
}

function LlmSettingsForm() {
  const [saved, setSaved] = useState<LlmSettings>();
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [testing, setTesting] = useState(false);

  const load = (settings: LlmSettings) => (setSaved(settings), setProvider(settings.provider), setModel(settings.model));
  useEffect(() => void api.llmSettings().then(load, () => setMessage({ text: text.genericError, error: true })), []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!isProviderId(provider)) return;
    const res = await api.saveLlmSettings({ provider, model });
    if (res.ok) return (load(await res.json()), setMessage({ text: text.llmSettings.saved }));
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage({ text: text.llmSettings.errors[body.error ?? ""] ?? text.genericError, error: true });
  }

  /** Another provider won't know this one's model, so start from its first suggestion. */
  function changeProvider(id: string) {
    setProvider(id);
    if (isProviderId(id)) setModel(id === saved?.provider ? saved.model : providerInfo(id).models[0]);
    setMessage(undefined);
  }

  async function test() {
    setTesting(true);
    setMessage(undefined);
    try {
      const result = await api.testConnection();
      setMessage(result.ok ? { text: text.llmSettings.ok } : { text: text.llmSettings.testErrors[result.error](result.envVar, result.model), error: true });
    } catch {
      setMessage({ text: text.genericError, error: true });
    } finally {
      setTesting(false);
    }
  }

  if (!saved) return message ? <p className="error">{message.text}</p> : <p>{text.loading}</p>;
  const info = isProviderId(provider) ? providerInfo(provider) : undefined;
  const changed = provider !== saved.provider || model.trim() !== saved.model;
  return (
    <section>
      <h2>{text.llmSettings.heading}</h2>
      <p className="hint">{text.llmSettings.intro}</p>
      <form className="card" onSubmit={save}>
        <label>
          {text.llmSettings.providerLabel}
          <select value={provider} onChange={(e) => changeProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text.llmSettings.modelLabel}
          <input list="llm-models" value={model} onChange={(e) => (setModel(e.target.value), setMessage(undefined))} />
          <datalist id="llm-models">
            {info?.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>
        {info && <span className="hint">{text.llmSettings.keyHint(info.envVar)}</span>}
        {message && <p className={message.error ? "error" : "hint"}>{message.text}</p>}
        <div className="actions">
          <button type="submit" disabled={!changed}>
            {text.llmSettings.save}
          </button>
          {/* Tests the saved settings, so it waits until changes are saved. */}
          <button type="button" disabled={changed || testing} onClick={() => void test()}>
            {testing ? text.llmSettings.testing : text.llmSettings.test}
          </button>
        </div>
      </form>
    </section>
  );
}

/** The teaching settings' form fields, each with its label, hint and allowed range. */
const TEACHING_FIELDS: { name: keyof TeachingSettings; label: string; hint: string; min: number; max: number }[] = [
  { name: "maxReExplanations", label: text.teachingSettings.maxReExplanationsLabel, hint: text.teachingSettings.hint, min: 0, max: MAX_RE_EXPLANATIONS_LIMIT },
  { name: "passMark", label: text.teachingSettings.passMarkLabel, hint: text.teachingSettings.passMarkHint, min: 1, max: 100 },
  {
    name: "maxQuizAttempts",
    label: text.teachingSettings.maxQuizAttemptsLabel,
    hint: text.teachingSettings.maxQuizAttemptsHint,
    min: 1,
    max: MAX_QUIZ_ATTEMPTS_LIMIT,
  },
];

function TeachingSettingsForm() {
  const [values, setValues] = useState<Record<keyof TeachingSettings, string>>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  useEffect(
    () =>
      void api.teachingSettings().then(
        (s) => setValues({ maxReExplanations: String(s.maxReExplanations), passMark: String(s.passMark), maxQuizAttempts: String(s.maxQuizAttempts) }),
        () => setMessage({ text: text.genericError, error: true }),
      ),
    [],
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    const res = await api.saveTeachingSettings({
      maxReExplanations: Number(values.maxReExplanations),
      passMark: Number(values.passMark),
      maxQuizAttempts: Number(values.maxQuizAttempts),
    });
    if (res.ok) return setMessage({ text: text.teachingSettings.saved });
    const { error } = await res.json().catch(() => ({}));
    setMessage({ text: text.teachingSettings.errors[error] ?? text.genericError, error: true });
  }

  if (values === undefined) return message ? <p className="error">{message.text}</p> : <p>{text.loading}</p>;
  return (
    <section>
      <h2>{text.teachingSettings.heading}</h2>
      <form className="card" onSubmit={save}>
        {TEACHING_FIELDS.map(({ name, label, hint, min, max }) => (
          <label key={name}>
            {label}
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={values[name]}
              onChange={(e) => (setValues({ ...values, [name]: e.target.value }), setMessage(undefined))}
            />
            <span className="hint">{hint}</span>
          </label>
        ))}
        {message && <p className={message.error ? "error" : "hint"}>{message.text}</p>}
        <button type="submit">{text.teachingSettings.save}</button>
      </form>
    </section>
  );
}

function Usage() {
  const [days, setDays] = useState<DailyUsage[]>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.usage().then(setDays, () => setError(text.genericError)), []);

  if (error) return <p className="error">{error}</p>;
  if (!days) return <p>{text.loading}</p>;
  return (
    <section>
      <h2>{text.usage.heading}</h2>
      {days.length === 0 && <p>{text.usage.none}</p>}
      <ul>
        {days.map((d) => (
          <li key={d.date}>{text.usage.day(d.date, d.calls, d.inputTokens, d.outputTokens)}</li>
        ))}
      </ul>
    </section>
  );
}

function LearnerLogin({ onDone, onParent }: { onDone: () => void; onParent: () => void }) {
  const [profiles, setProfiles] = useState<LearnerProfile[]>();
  const [chosen, setChosen] = useState<LearnerProfile>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => void api.learnerProfiles().then(setProfiles, () => setError(text.genericError)), []);

  async function login(profile: LearnerProfile, pin?: string) {
    const res = await api.loginLearner(profile.id, pin);
    if (res.ok) return onDone();
    setPin("");
    setError(res.status === 401 && profile.hasPin ? text.learnerLogin.wrongPin : text.genericError);
  }

  function choose(profile: LearnerProfile) {
    setError(undefined);
    if (profile.hasPin) setChosen(profile);
    else void login(profile);
  }

  if (chosen) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login(chosen, pin);
        }}
      >
        <h1>{text.learnerLogin.pinHeading(chosen.name)}</h1>
        <label>
          {text.learnerLogin.pinLabel}
          <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">{text.learnerLogin.submit}</button>
        <button type="button" className="link" onClick={() => (setChosen(undefined), setPin(""), setError(undefined))}>
          {text.learnerLogin.back}
        </button>
      </form>
    );
  }

  return (
    <section>
      <h1>{text.learnerLogin.heading}</h1>
      {!profiles && !error && <p>{text.loading}</p>}
      {profiles?.length === 0 && <p>{text.learnerLogin.noProfiles}</p>}
      <div className="profiles">
        {profiles?.map((profile) => (
          <button key={profile.id} type="button" className="profile" onClick={() => choose(profile)}>
            {profile.name}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="link" onClick={onParent}>
        {text.learnerLogin.parentLink}
      </button>
    </section>
  );
}

function LearnerHome({ learner, onLogout }: { learner: LoggedInLearner; onLogout: () => void }) {
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
          <h2>{card.title}</h2>
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

/** A Tutor Session on one Goal: the transcript, the Tutor's reply as it streams in, and the Learner's answer box. */
function SessionChat({ goalId, onBack }: { goalId: number; onBack: () => void }) {
  const [session, setSession] = useState<TutorSession>();
  const [streaming, setStreaming] = useState<string>();
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string>();

  /** Opens (or resumes) the Session; a new one, or one whose Explanation never arrived, starts with the Explanation. */
  async function open(isCancelled = () => false) {
    try {
      const opened = await api.openSession(goalId);
      if (isCancelled()) return;
      setSession(opened);
      if (opened.step === "explanation") await takeTurn(opened);
    } catch {
      setError(text.genericError);
    }
  }

  /** One turn; the Learner's message shows straight away, and goes back to the answer box if the turn fails. */
  async function takeTurn(current: TutorSession, message?: string) {
    const pending: SessionMessage[] = message === undefined ? current.messages : [...current.messages, { role: "learner", content: message }];
    setSession({ ...current, messages: pending });
    setFailed(false);
    setStreaming("");
    let reply = "";
    const result = await api
      .turn(current.id, message, (piece) => {
        reply += piece;
        setStreaming(reply);
      })
      .catch(() => ({ error: "llmFailed" as const }));
    setStreaming(undefined);
    if ("step" in result) return setSession({ ...current, step: result.step, messages: [...pending, { role: "tutor", content: reply }] });
    setSession(current);
    if (message !== undefined) setDraft(message);
    // Another tab moved the Session on first: show where it is now.
    if (result.error === "sessionChanged") return open();
    setFailed(true);
  }

  useEffect(() => {
    // Development mode runs effects twice; only the second may start the Explanation.
    let cancelled = false;
    void open(() => cancelled);
    return () => void (cancelled = true);
  }, [goalId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!session || draft.trim() === "") return;
    const message = draft.trim();
    setDraft("");
    await takeTurn(session, message);
  }

  const busy = streaming !== undefined;
  return (
    <section className="session">
      <button type="button" className="link" onClick={onBack}>
        {text.session.back}
      </button>
      {error && <p className="error">{error}</p>}
      {!session && !error && <p>{text.loading}</p>}
      {session && (
        <>
          <p className="subject">{session.subjectName}</p>
          <h1>{session.title}</h1>
          <ol className="transcript">
            {session.messages.map((m, i) => (
              <li key={i} className={m.role}>
                <span className="speaker">{m.role === "tutor" ? text.session.tutor : text.session.you}</span>
                {m.role === "tutor" ? <MathText text={m.content} /> : m.content}
              </li>
            ))}
            {busy && (
              <li className="tutor" aria-live="polite">
                <span className="speaker">{text.session.tutor}</span>
                {streaming ? <MathText text={streaming} /> : <span className="hint">{text.session.thinking}</span>}
              </li>
            )}
          </ol>
          {failed && (
            <p className="error">
              {text.session.failed}{" "}
              {/* A failed answer is back in the answer box to send again; a failed Explanation or re-teaching needs this button. */}
              {TUTOR_STARTED_STEPS.includes(session.step) && (
                <button type="button" onClick={() => void takeTurn(session)}>
                  {text.session.retry}
                </button>
              )}
            </p>
          )}
          {session.step === "understanding-check" && (
            <form className="answer" onSubmit={send}>
              <label>
                {text.session.messageLabel}
                <textarea rows={3} value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button type="submit" disabled={busy || draft.trim() === ""}>
                {text.session.send}
              </button>
            </form>
          )}
          {!busy && session.step === "ready-for-quiz" && <QuizStart session={session} onStarted={setSession} onChanged={() => void open()} />}
          {session.quiz && session.step !== "ready-for-quiz" && !failed && !busy && (
            <QuizPanel
              session={session}
              quiz={session.quiz}
              onAnswered={setSession}
              onChanged={() => void open()}
              onContinue={() => void takeTurn(session)}
            />
          )}
          {session.step === "ended" && !session.quiz && <p className="hint">{text.session.ended}</p>}
        </>
      )}
    </section>
  );
}

/** Starts the next Quiz attempt; the Tutor writes the questions first. */
function QuizStart({ session, onStarted, onChanged }: { session: TutorSession; onStarted: (s: TutorSession) => void; onChanged: () => void }) {
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setWriting(true);
    setFailed(false);
    const result = await api.startQuiz(session.id).catch(() => ({ error: "llmFailed" }));
    setWriting(false);
    if ("id" in result) return onStarted(result);
    // Another tab started the attempt first: show it.
    if (result.error === "sessionChanged" || result.error === "noQuizNow") return onChanged();
    setFailed(true);
  }

  if (writing) return <p className="hint" aria-live="polite">{text.quiz.writing}</p>;
  return (
    <div className="quiz">
      {failed && <p className="error">{text.quiz.failed}</p>}
      <button type="button" onClick={() => void start()}>
        {failed ? text.session.retry : session.quiz ? text.quiz.startAgain : text.quiz.start}
      </button>
    </div>
  );
}

/**
 * A Quiz attempt, one question at a time: right or wrong with a one-line explanation after each answer,
 * then the score and what comes next. Resuming starts at the first unanswered question.
 */
function QuizPanel({
  session,
  quiz,
  onAnswered,
  onChanged,
  onContinue,
}: {
  session: TutorSession;
  quiz: QuizAttempt;
  onAnswered: (s: TutorSession) => void;
  onChanged: () => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState("");
  /** The question just answered, whose feedback shows until the Learner moves on. */
  const [reviewing, setReviewing] = useState<number>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();

  const index = reviewing !== undefined ? quiz.questions.findIndex((q) => q.id === reviewing) : quiz.questions.findIndex((q) => !q.answered);
  const question = quiz.questions[index];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question || draft.trim() === "") return;
    setChecking(true);
    setError(undefined);
    const result = await api.answer(session.id, question.id, draft.trim()).catch(() => ({ error: "llmFailed" }));
    setChecking(false);
    if ("error" in result) {
      if (result.error === "sessionChanged") return onChanged();
      return setError(text.quiz.errors[result.error] ?? text.quiz.failed);
    }
    const answered = { ...question, answered: { answer: draft.trim(), ...result.feedback } };
    onAnswered({
      ...session,
      step: result.step,
      quiz: { ...quiz, score: result.score, questions: quiz.questions.map((q) => (q.id === question.id ? answered : q)) },
    });
    setReviewing(question.id);
    setDraft("");
  }

  const heading = (
    <h2>
      {text.quiz.heading}
      {quiz.number > 1 && <span className="hint"> · {text.quiz.attempt(quiz.number, quiz.maxAttempts)}</span>}
    </h2>
  );

  if (!question && quiz.score) {
    return (
      <div className="quiz card" aria-live="polite">
        {heading}
        <p className="score">{text.quiz.score(quiz.score.correct, quiz.score.total)}</p>
        {session.step === "goal-met" && <p>{text.quiz.met}</p>}
        {session.step === "ended" && <p className="hint">{text.quiz.ended}</p>}
        {session.step === "re-teaching" && (
          <>
            <p>{text.quiz.reTeach}</p>
            <button type="button" onClick={onContinue}>
              {text.quiz.continue}
            </button>
          </>
        )}
      </div>
    );
  }
  if (!question) return null;

  const feedback = question.answered;
  return (
    <div className="quiz card">
      {heading}
      <p className="hint">{text.quiz.question(index + 1, quiz.questions.length)}</p>
      <div className="prompt">
        <MathText text={question.prompt} />
      </div>
      {feedback ? (
        <div className={feedback.correct ? "feedback right" : "feedback wrong"} aria-live="polite">
          <p>
            <strong>{feedback.correct ? text.quiz.right : text.quiz.wrong}</strong> <MathText text={feedback.explanation} />
          </p>
          {!feedback.correct && (
            <p className="hint">
              <MathText text={text.quiz.correctAnswer(feedback.correctAnswer)} />
            </p>
          )}
          <button type="button" onClick={() => setReviewing(undefined)}>
            {quiz.score ? text.quiz.seeScore : text.quiz.next}
          </button>
        </div>
      ) : (
        <form className="answer" onSubmit={submit}>
          {question.type === "multiple-choice" && (
            <fieldset className="choices">
              {question.choices.map((choice) => (
                <label key={choice} className="choice">
                  <input type="radio" name={`q${question.id}`} value={choice} checked={draft === choice} onChange={() => setDraft(choice)} />
                  <MathText text={choice} />
                </label>
              ))}
            </fieldset>
          )}
          {question.type === "number" && (
            <label>
              {text.quiz.numberLabel}
              <input type="text" inputMode="decimal" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <span className="hint">{text.quiz.numberHint}</span>
            </label>
          )}
          {question.type === "short-answer" && (
            <label>
              {text.quiz.writtenLabel}
              <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={checking || draft.trim() === ""}>
            {checking ? text.quiz.checking : text.quiz.submit}
          </button>
        </form>
      )}
    </div>
  );
}

function Learners() {
  const [learners, setLearners] = useState<Learner[]>();
  const [curricula, setCurricula] = useState<CurriculumSummary[]>();
  const [editing, setEditing] = useState<Learner>();
  const [error, setError] = useState<string>();

  const refresh = () =>
    Promise.all([api.learners(), api.curricula()]).then(([l, c]) => {
      setLearners(l);
      setCurricula(c);
    }, () => setError(text.genericError));
  useEffect(() => void refresh(), []);

  async function remove(learner: Learner) {
    if (!window.confirm(text.learners.confirmRemove(learner.name))) return;
    const res = await api.removeLearner(learner.id);
    if (!res.ok) setError(text.genericError);
    void refresh();
  }

  if (error) return <p className="error">{error}</p>;
  if (!learners || !curricula) return <p>{text.loading}</p>;
  const curriculumIds = curricula.filter((c) => c.valid).map((c) => c.id);
  return (
    <section>
      <h2>{text.learners.heading}</h2>
      {learners.length === 0 && <p>{text.learners.none}</p>}
      {learners.map((learner) =>
        editing?.id === learner.id ? (
          <LearnerForm
            key={learner.id}
            learner={learner}
            curriculumIds={curriculumIds}
            onDone={() => (setEditing(undefined), void refresh())}
            onCancel={() => setEditing(undefined)}
          />
        ) : (
          <article key={learner.id} className="card">
            <h3>{learner.name}</h3>
            <p className="hint">{text.learners.details(learner.grade, learner.curriculumId, learner.hasPin)}</p>
            <Goals learner={learner} />
            <div className="actions">
              <button type="button" onClick={() => setEditing(learner)}>
                {text.learners.edit}
              </button>
              <button type="button" onClick={() => void remove(learner)}>
                {text.learners.remove}
              </button>
            </div>
          </article>
        ),
      )}
      {!editing &&
        (curriculumIds.length === 0 ? (
          <p className="hint">{text.learners.noValidCurricula}</p>
        ) : (
          <LearnerForm curriculumIds={curriculumIds} onDone={() => void refresh()} />
        ))}
    </section>
  );
}

/**
 * A Learner's Goals in the Parent area: each Goal's Target Date to edit, moving it up or down its Subject's queue
 * and skipping it; a form to set a new Goal, at the end of its Subject's queue or before another of its Goals;
 * and a form to spread Target Dates over a Term.
 */
function Goals({ learner }: { learner: Learner }) {
  const [goals, setGoals] = useState<Goal[]>();
  const [lessons, setLessons] = useState<LessonOption[]>();
  const [lessonKey, setLessonKey] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [beforeGoalId, setBeforeGoalId] = useState("");
  const [termKey, setTermKey] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [error, setError] = useState<string>();

  const refresh = () =>
    Promise.all([api.goals(learner.id), api.lessons(learner.id)]).then(([g, l]) => {
      setGoals(g);
      setLessons(l);
      setLessonKey((key) => key || (l[0]?.key ?? ""));
      setTermKey((key) => key || (l[0]?.termKey ?? ""));
    }, () => setError(text.genericError));
  // Re-read when the Learner is edited, since a new Curriculum means new Lessons.
  useEffect(() => void refresh(), [learner.id, learner.curriculumId]);

  /** Re-reads the Goals once `res` went through, or shows what went wrong. Returns whether it went through. */
  async function settle(res: Response): Promise<boolean> {
    if (res.ok) return (setError(undefined), void refresh(), true);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(text.goals.errors[body.error ?? ""] ?? text.genericError);
    return false;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = { lessonKey, targetDate, ...(beforeGoalId && { beforeGoalId: Number(beforeGoalId) }) };
    if (await settle(await api.createGoal(learner.id, input))) (setTargetDate(""), setBeforeGoalId(""));
  }

  async function spread(e: FormEvent) {
    e.preventDefault();
    if (await settle(await api.spreadTargetDates(learner.id, { termKey, termEndDate }))) setTermEndDate("");
  }

  /** Swaps `goal` with its neighbour `by` places along its Subject's queue. */
  async function move(goal: Goal, by: -1 | 1) {
    const ids = goals!.filter((g) => g.subjectKey === goal.subjectKey).map((g) => g.id);
    const from = ids.indexOf(goal.id);
    [ids[from], ids[from + by]] = [ids[from + by]!, ids[from]!];
    await settle(await api.reorderGoals(learner.id, { goalIds: ids }));
  }

  if (!goals || !lessons) return error ? <p className="error">{error}</p> : <p>{text.loading}</p>;
  // A new Goal can only be inserted into its own Subject's queue.
  const lessonSubject = lessons.find((l) => l.key === lessonKey)?.subjectName;
  const insertPoints = goals.filter((g) => g.subjectName === lessonSubject);
  const terms = [...new Map(lessons.map((l) => [l.termKey, l])).values()];
  return (
    <>
      <h4>{text.goals.heading}</h4>
      {goals.length === 0 && <p className="hint">{text.goals.none}</p>}
      <ul className="goals">
        {goals.map((goal, i) => {
          const sameSubject = (other: Goal | undefined) => other?.subjectKey === goal.subjectKey;
          return (
            <li key={goal.id}>
              {text.goals.goal(goal.subjectName, goal.title, goal.targetDate)}
              {text.goals.status[goal.status] && ` · ${text.goals.status[goal.status]}`}
              {goal.overdue && <span className="overdue"> · {text.goals.overdue}</span>}
              <span className="goal-actions">
                <input
                  type="date"
                  aria-label={text.goals.editTargetDate(goal.title)}
                  // Keyed by the date so a re-read (after spreading, say) shows the new one.
                  key={goal.targetDate}
                  defaultValue={goal.targetDate}
                  onBlur={async (e) => {
                    const date = e.target.value;
                    if (date && date !== goal.targetDate) await settle(await api.editTargetDate(learner.id, goal.id, date));
                  }}
                />
                <button type="button" disabled={!sameSubject(goals[i - 1])} onClick={() => void move(goal, -1)}>
                  {text.goals.moveUp}
                </button>
                <button type="button" disabled={!sameSubject(goals[i + 1])} onClick={() => void move(goal, 1)}>
                  {text.goals.moveDown}
                </button>
                {goal.status === "active" && (
                  <button type="button" onClick={async () => void (await settle(await api.skipGoal(learner.id, goal.id)))}>
                    {text.goals.skip}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
      {lessons.length === 0 ? (
        <p className="hint">{text.goals.noLessons}</p>
      ) : (
        <>
          <form onSubmit={submit}>
            <label>
              {text.goals.lessonLabel}
              <select value={lessonKey} onChange={(e) => (setLessonKey(e.target.value), setBeforeGoalId(""))}>
                {[...new Set(lessons.map((l) => l.subjectName))].map((subjectName) => (
                  <optgroup key={subjectName} label={subjectName}>
                    {lessons
                      .filter((l) => l.subjectName === subjectName)
                      .map((l) => (
                        <option key={l.key} value={l.key}>
                          {text.goals.lessonOption(l.unitTitle, l.title)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              {text.goals.targetDateLabel}
              <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
            {insertPoints.length > 0 && (
              <label>
                {text.goals.positionLabel}
                <select value={beforeGoalId} onChange={(e) => setBeforeGoalId(e.target.value)}>
                  <option value="">{text.goals.atEnd}</option>
                  {insertPoints.map((g) => (
                    <option key={g.id} value={g.id}>
                      {text.goals.before(g.title)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit">{text.goals.add}</button>
          </form>
          <h4>{text.goals.spreadHeading}</h4>
          <p className="hint">{text.goals.spreadHint}</p>
          <form onSubmit={spread}>
            <label>
              {text.goals.termLabel}
              <select value={termKey} onChange={(e) => setTermKey(e.target.value)}>
                {terms.map((l) => (
                  <option key={l.termKey} value={l.termKey}>
                    {text.goals.termOption(l.subjectName, l.termName)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text.goals.termEndDateLabel}
              <input type="date" required value={termEndDate} onChange={(e) => setTermEndDate(e.target.value)} />
            </label>
            <button type="submit">{text.goals.spread}</button>
          </form>
        </>
      )}
    </>
  );
}

/** Adds a Learner, or edits `learner` when given. */
function LearnerForm({
  learner,
  curriculumIds,
  onDone,
  onCancel,
}: {
  learner?: Learner;
  curriculumIds: string[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(learner?.name ?? "");
  const [grade, setGrade] = useState(learner?.grade ?? "");
  // Keep a Learner's current Curriculum selectable even while it is invalid.
  const options = learner && !curriculumIds.includes(learner.curriculumId) ? [learner.curriculumId, ...curriculumIds] : curriculumIds;
  const [curriculumId, setCurriculumId] = useState(learner?.curriculumId ?? options[0] ?? "");
  const [pin, setPin] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== "" && !PIN_PATTERN.test(pin)) return setError(text.learners.errors.invalidPin);
    // On edit, an empty PIN field keeps the current PIN.
    const input: LearnerInput = { name, grade, curriculumId, pin: removePin ? null : pin === "" ? undefined : pin };
    const res = learner ? await api.editLearner(learner.id, input) : await api.createLearner(input);
    if (res.ok) {
      if (!learner) (setName(""), setGrade(""), setPin(""));
      setError(undefined);
      return onDone();
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(text.learners.errors[body.error ?? ""] ?? text.genericError);
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>{learner ? text.learners.editHeading(learner.name) : text.learners.addHeading}</h3>
      <label>
        {text.learners.nameLabel}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {text.learners.gradeLabel}
        <input value={grade} onChange={(e) => setGrade(e.target.value)} />
      </label>
      <label>
        {text.learners.curriculumLabel}
        <select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label>
        {learner ? text.learners.newPinLabel : text.learners.pinLabel}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          disabled={removePin}
          onChange={(e) => setPin(e.target.value)}
        />
      </label>
      <span className="hint">{learner ? text.learners.newPinHint : text.learners.pinHint}</span>
      {learner?.hasPin && (
        <label className="checkbox">
          <input type="checkbox" checked={removePin} onChange={(e) => setRemovePin(e.target.checked)} />
          {text.learners.removePin}
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit">{learner ? text.learners.save : text.learners.add}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            {text.learners.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
