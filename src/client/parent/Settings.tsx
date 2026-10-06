import { useEffect, useState, type FormEvent } from "react";
import type { LlmSettings, TeachingSettings } from "../../shared/api";
import { MAX_BREAK_MINUTES, MAX_QUIZ_ATTEMPTS_LIMIT, MAX_RE_EXPLANATIONS_LIMIT } from "../../shared/api";
import { PROVIDERS, isProviderId, providerInfo } from "../../shared/llm";
import { api } from "../api";
import { text } from "../text";

export function LlmSettingsForm() {
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

export function TeachingSettingsForm() {
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

/** The daily token cap (empty for none) and when the Learner is prompted to take a break. */
export function LimitSettingsForm() {
  const [values, setValues] = useState<{ dailyTokenCap: string; breakMinutes: string }>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  useEffect(
    () =>
      void api.limitSettings().then(
        (s) => setValues({ dailyTokenCap: s.dailyTokenCap === null ? "" : String(s.dailyTokenCap), breakMinutes: String(s.breakMinutes) }),
        () => setMessage({ text: text.genericError, error: true }),
      ),
    [],
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    const cap = values.dailyTokenCap.trim();
    const res = await api.saveLimitSettings({ dailyTokenCap: cap === "" ? null : Number(cap), breakMinutes: Number(values.breakMinutes) });
    if (res.ok) return setMessage({ text: text.limitSettings.saved });
    const { error } = await res.json().catch(() => ({}));
    setMessage({ text: text.limitSettings.errors[error] ?? text.genericError, error: true });
  }

  const change = (name: keyof NonNullable<typeof values>) => (e: { target: { value: string } }) =>
    values && (setValues({ ...values, [name]: e.target.value }), setMessage(undefined));
  if (values === undefined) return message ? <p className="error">{message.text}</p> : <p>{text.loading}</p>;
  return (
    <section>
      <h2>{text.limitSettings.heading}</h2>
      <form className="card" onSubmit={save}>
        <label>
          {text.limitSettings.dailyTokenCapLabel}
          <input type="number" min={1} step={1} value={values.dailyTokenCap} onChange={change("dailyTokenCap")} />
          <span className="hint">{text.limitSettings.dailyTokenCapHint}</span>
        </label>
        <label>
          {text.limitSettings.breakMinutesLabel}
          <input type="number" min={1} max={MAX_BREAK_MINUTES} step={1} value={values.breakMinutes} onChange={change("breakMinutes")} />
          <span className="hint">{text.limitSettings.breakMinutesHint}</span>
        </label>
        {message && <p className={message.error ? "error" : "hint"}>{message.text}</p>}
        <button type="submit">{text.limitSettings.save}</button>
      </form>
    </section>
  );
}
