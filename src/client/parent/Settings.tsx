import { useEffect, useState, type FormEvent } from "react";
import type { LlmSettings, TeachingSettings } from "../../shared/api";
import { MAX_BREAK_MINUTES, MAX_QUIZ_ATTEMPTS_LIMIT, MAX_RE_EXPLANATIONS_LIMIT } from "../../shared/api";
import { PROVIDERS, isProviderId, providerInfo } from "../../shared/llm";
import { api } from "../api";
import { Button, Card, Field } from "../components/ui";
import { text } from "../text";

type Message = { text: string; error?: boolean };

/** A form's last outcome: "Saved." or what went wrong. */
function Status({ message }: { message?: Message }) {
  if (!message) return null;
  return message.error ? (
    <p className="text-warm" role="alert">
      {message.text}
    </p>
  ) : (
    <p className="muted" role="status">
      {message.text}
    </p>
  );
}

/** Until a form's settings arrive: loading, or the error that stopped them. */
const NotLoaded = ({ message }: { message?: Message }) => (message ? <Status message={message} /> : <p className="muted">{text.loading}</p>);

export function LlmSettingsForm() {
  const [saved, setSaved] = useState<LlmSettings>();
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState<Message>();
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

  if (!saved) return <NotLoaded message={message} />;
  const info = isProviderId(provider) ? providerInfo(provider) : undefined;
  const changed = provider !== saved.provider || model.trim() !== saved.model;
  return (
    <Card className="settings-card">
      <form onSubmit={save}>
        <h2 className="h3">{text.llmSettings.heading}</h2>
        <p className="muted">{text.llmSettings.intro}</p>
        <Field label={text.llmSettings.providerLabel}>
          <select value={provider} onChange={(e) => changeProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={text.llmSettings.modelLabel} hint={info && text.llmSettings.keyHint(info.envVar)}>
          <input list="llm-models" value={model} onChange={(e) => (setModel(e.target.value), setMessage(undefined))} />
        </Field>
        <datalist id="llm-models">
          {info?.models.map((m) => <option key={m} value={m} />)}
        </datalist>
        <Status message={message} />
        <div className="form-actions">
          <Button type="submit" disabled={!changed}>
            {text.llmSettings.save}
          </Button>
          {/* Tests the saved settings, so it waits until changes are saved. */}
          <Button kind="outline" disabled={changed || testing} onClick={() => void test()}>
            {testing ? text.llmSettings.testing : text.llmSettings.test}
          </Button>
        </div>
      </form>
    </Card>
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
  const [message, setMessage] = useState<Message>();
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

  if (values === undefined) return <NotLoaded message={message} />;
  return (
    <Card className="settings-card">
      <form onSubmit={save}>
        <h2 className="h3">{text.teachingSettings.heading}</h2>
        {TEACHING_FIELDS.map(({ name, label, hint, min, max }) => (
          <Field key={name} label={label} hint={hint}>
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={values[name]}
              onChange={(e) => (setValues({ ...values, [name]: e.target.value }), setMessage(undefined))}
            />
          </Field>
        ))}
        <Status message={message} />
        <div className="form-actions">
          <Button type="submit">{text.teachingSettings.save}</Button>
        </div>
      </form>
    </Card>
  );
}

/** The daily token cap (empty for none) and when the Learner is prompted to take a break. */
export function LimitSettingsForm() {
  const [values, setValues] = useState<{ dailyTokenCap: string; breakMinutes: string }>();
  const [message, setMessage] = useState<Message>();
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
  if (values === undefined) return <NotLoaded message={message} />;
  return (
    <Card className="settings-card">
      <form onSubmit={save}>
        <h2 className="h3">{text.limitSettings.heading}</h2>
        <Field label={text.limitSettings.dailyTokenCapLabel} hint={text.limitSettings.dailyTokenCapHint}>
          <input type="number" min={1} step={1} value={values.dailyTokenCap} onChange={change("dailyTokenCap")} />
        </Field>
        <Field label={text.limitSettings.breakMinutesLabel} hint={text.limitSettings.breakMinutesHint}>
          <input type="number" min={1} max={MAX_BREAK_MINUTES} step={1} value={values.breakMinutes} onChange={change("breakMinutes")} />
        </Field>
        <Status message={message} />
        <div className="form-actions">
          <Button type="submit">{text.limitSettings.save}</Button>
        </div>
      </form>
    </Card>
  );
}
