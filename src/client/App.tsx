import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "../shared/auth";
import type { CurriculumSummary, ParentStatus } from "../shared/api";
import { api } from "./api";
import { text } from "./text";

export function App() {
  const [status, setStatus] = useState<ParentStatus>();
  const [error, setError] = useState<string>();

  const refresh = () => api.parentStatus().then(setStatus, () => setError(text.genericError));
  useEffect(() => void refresh(), []);

  let content;
  if (error) content = <p className="error">{error}</p>;
  else if (!status) content = <p>{text.loading}</p>;
  else if (!status.passwordSet) content = <SetupForm onDone={refresh} />;
  else if (!status.loggedIn) content = <LoginForm onDone={refresh} />;
  else content = <ParentArea onLogout={refresh} />;

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

function LoginForm({ onDone }: { onDone: () => void }) {
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
    </form>
  );
}

function ParentArea({ onLogout }: { onLogout: () => void }) {
  return (
    <section>
      <h1>{text.parentArea.heading}</h1>
      <Curricula />
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
