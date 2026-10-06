import { useEffect, useState, type FormEvent } from "react";
import { PIN_PATTERN } from "../../shared/auth";
import { ACCENT_COLORS, AVATARS, isAccentColor, isAvatarId, type AccentColor, type AvatarId, type CurriculumSummary, type Learner, type LearnerInput } from "../../shared/api";
import { Avatar } from "../components/Avatar";
import { Button, Card, Field } from "../components/ui";
import { api } from "../api";
import { text } from "../text";
import { Goals } from "./Goals";
import { Progress } from "./Progress";

/** The Learner the Parent is looking at, or the form to add one. */
type Selection = { learnerId: number } | "add";

/** The Parent's Learners: a list beside the one picked (the first, until another is), with its Goals and progress. */
export function Learners() {
  const [learners, setLearners] = useState<Learner[]>();
  const [curricula, setCurricula] = useState<CurriculumSummary[]>();
  const [selection, setSelection] = useState<Selection>();
  const [error, setError] = useState<string>();

  // Re-read after any Goal change too, so each Learner's count of Goals needing attention stays current.
  const refresh = () =>
    Promise.all([api.learners(), api.curricula()]).then(([l, c]) => {
      setLearners(l);
      setCurricula(c);
    }, () => setError(text.genericError));
  useEffect(() => void refresh(), []);

  if (error) return <main className="parent-page text-warm">{error}</main>;
  if (!learners || !curricula) return <main className="parent-page muted">{text.loading}</main>;
  const curriculumIds = curricula.filter((c) => c.valid).map((c) => c.id);
  const current = selection === "add" ? undefined : (learners.find((l) => l.id === selection?.learnerId) ?? learners[0]);
  return (
    <div className="parent-layout">
      <aside className="learner-list">
        <h2 className="eyebrow">{text.learners.heading}</h2>
        {learners.length === 0 && <p className="muted">{text.learners.none}</p>}
        <ul>
          {learners.map((learner) => (
            <li key={learner.id}>
              <button
                type="button"
                className="learner-pick"
                aria-current={learner.id === current?.id ? "page" : undefined}
                onClick={() => setSelection({ learnerId: learner.id })}
              >
                <Avatar {...learner} size={36} />
                <span className="learner-pick-name">
                  <b>{learner.name}</b>
                  <small>{text.learners.grade(learner.grade)}</small>
                </span>
                {learner.needsAttention > 0 && (
                  <>
                    <span className="attention-count" aria-hidden>
                      {learner.needsAttention}
                    </span>
                    <span className="visually-hidden">{text.learners.needsAttention(learner.needsAttention)}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
        {current && (
          <Button kind="outline" onClick={() => setSelection("add")}>
            {text.learners.addHeading}
          </Button>
        )}
      </aside>
      <main className="parent-main screen-enter" key={current?.id ?? "add"}>
        {current ? (
          <LearnerPanel learner={current} curriculumIds={curriculumIds} onChanged={() => void refresh()} onRemoved={() => (setSelection(undefined), void refresh())} />
        ) : curriculumIds.length === 0 ? (
          <p className="muted">{text.learners.noValidCurricula}</p>
        ) : (
          <LearnerForm
            curriculumIds={curriculumIds}
            onDone={(learner) => (setSelection({ learnerId: learner.id }), void refresh())}
            onCancel={learners.length > 0 ? () => setSelection(undefined) : undefined}
          />
        )}
      </main>
    </div>
  );
}

/** One Learner: who they are, then their Goals or their progress; or the form to edit them. */
function LearnerPanel({
  learner,
  curriculumIds,
  onChanged,
  onRemoved,
}: {
  learner: Learner;
  curriculumIds: string[];
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const [view, setView] = useState<"goals" | "progress" | "edit">("goals");
  const [error, setError] = useState<string>();

  async function remove() {
    if (!window.confirm(text.learners.confirmRemove(learner.name))) return;
    const res = await api.removeLearner(learner.id);
    if (!res.ok) return setError(text.genericError);
    onRemoved();
  }

  if (view === "edit") {
    return (
      <LearnerForm
        learner={learner}
        curriculumIds={curriculumIds}
        onDone={() => (setView("goals"), onChanged())}
        onCancel={() => setView("goals")}
        onRemove={() => void remove()}
        removeError={error}
      />
    );
  }
  const views = ["goals", "progress"] as const;
  return (
    <>
      <header className="parent-head">
        <Avatar {...learner} size={48} />
        <div className="parent-head-title">
          <h1 className="h2">{learner.name}</h1>
          <span className="muted">{text.learners.details(learner.grade, learner.curriculumId, learner.hasPin)}</span>
        </div>
        <Button kind="outline" onClick={() => setView("edit")}>
          {text.learners.edit}
        </Button>
      </header>
      <nav className="view-tabs" aria-label={text.learners.viewsLabel}>
        {views.map((v) => (
          <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
            {text.learners.views[v]}
          </button>
        ))}
      </nav>
      {view === "goals" ? <Goals learner={learner} onChange={onChanged} /> : <Progress learner={learner} />}
    </>
  );
}

/** Adds a Learner, or edits `learner` when given (and offers to remove them). */
function LearnerForm({
  learner,
  curriculumIds,
  onDone,
  onCancel,
  onRemove,
  removeError,
}: {
  learner?: Learner;
  curriculumIds: string[];
  onDone: (learner: Learner) => void;
  onCancel?: () => void;
  onRemove?: () => void;
  removeError?: string;
}) {
  const [name, setName] = useState(learner?.name ?? "");
  const [grade, setGrade] = useState(learner?.grade ?? "");
  // Keep a Learner's current Curriculum selectable even while it is invalid.
  const options = learner && !curriculumIds.includes(learner.curriculumId) ? [learner.curriculumId, ...curriculumIds] : curriculumIds;
  const [curriculumId, setCurriculumId] = useState(learner?.curriculumId ?? options[0] ?? "");
  const [pin, setPin] = useState("");
  const [removePin, setRemovePin] = useState(false);
  const [avatar, setAvatar] = useState<AvatarId | null>(learner?.avatar ?? null);
  const [color, setColor] = useState<AccentColor | undefined>(learner?.color);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== "" && !PIN_PATTERN.test(pin)) return setError(text.learners.errors.invalidPin);
    // On edit, an empty PIN field keeps the current PIN.
    // A new Learner gets the next colour in line and picks their own Avatar at their first login.
    const input: LearnerInput = { name, grade, curriculumId, pin: removePin ? null : pin === "" ? undefined : pin, ...(learner && { avatar, color }) };
    const res = learner ? await api.editLearner(learner.id, input) : await api.createLearner(input);
    if (res.ok) return onDone((await res.json()) as Learner);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(text.learners.errors[body.error ?? ""] ?? text.genericError);
  }

  return (
    <Card className="learner-form">
      <form onSubmit={submit}>
        <h1 className="h2">{learner ? text.learners.editHeading(learner.name) : text.learners.addHeading}</h1>
        <div className="form-grid">
          <Field label={text.learners.nameLabel}>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={text.learners.gradeLabel}>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} />
          </Field>
          <Field label={text.learners.curriculumLabel}>
            <select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
              {options.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={learner ? text.learners.newPinLabel : text.learners.pinLabel} hint={learner ? text.learners.newPinHint : text.learners.pinHint}>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              disabled={removePin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          {learner && (
            <>
              <Field label={text.learners.avatarLabel}>
                <select value={avatar ?? ""} onChange={(e) => setAvatar(isAvatarId(e.target.value) ? e.target.value : null)}>
                  <option value="">{text.learners.noAvatar}</option>
                  {AVATARS.map((id) => (
                    <option key={id} value={id}>
                      {text.avatars[id]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={text.learners.colorLabel}>
                <select value={color} onChange={(e) => isAccentColor(e.target.value) && setColor(e.target.value)}>
                  {ACCENT_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {text.colors[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
        {learner?.hasPin && (
          <label className="check">
            <input type="checkbox" checked={removePin} onChange={(e) => setRemovePin(e.target.checked)} />
            {text.learners.removePin}
          </label>
        )}
        {(error ?? removeError) && <p className="text-warm" role="alert">{error ?? removeError}</p>}
        <div className="form-actions">
          <Button type="submit">{learner ? text.learners.save : text.learners.add}</Button>
          {onCancel && (
            <Button kind="outline" onClick={onCancel}>
              {text.learners.cancel}
            </Button>
          )}
          {learner && onRemove && (
            <Button kind="quiet" className="form-remove" onClick={onRemove}>
              {text.learners.removeLearner(learner.name)}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
