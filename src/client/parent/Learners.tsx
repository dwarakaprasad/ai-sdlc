import { useEffect, useState, type FormEvent } from "react";
import { PIN_PATTERN } from "../../shared/auth";
import type { CurriculumSummary, Learner, LearnerInput } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";
import { Goals } from "./Goals";
import { Progress } from "./Progress";

export function Learners() {
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
            <Progress learner={learner} />
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
