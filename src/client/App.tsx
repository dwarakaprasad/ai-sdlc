import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, PIN_PATTERN } from "../shared/auth";
import type { CurriculumSummary, DailyUsage, Learner, LearnerInput, LlmSettings, LoggedInLearner, LearnerProfile, ParentStatus } from "../shared/api";
import { PROVIDERS, isProviderId, providerInfo } from "../shared/llm";
import { api } from "./api";
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
          <select value={provider} onChange={(e) => (setProvider(e.target.value), setMessage(undefined))}>
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
  return (
    <section>
      <h1>{text.learnerHome.heading(learner.name)}</h1>
      <p>{text.learnerHome.noGoals}</p>
      <button type="button" onClick={() => api.logoutLearner().then(onLogout)}>
        {text.learnerHome.logout}
      </button>
    </section>
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
