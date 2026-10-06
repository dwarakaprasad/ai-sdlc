import { useState, type FormEvent } from "react";
import { ACCENT_COLORS, AVATARS, type AccentColor, type AvatarId, type LoggedInLearner } from "../../shared/api";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { ArrowIcon } from "../components/icons";
import { TutorMark } from "../components/TutorMark";
import { Button } from "../components/ui";
import { text } from "../text";

/**
 * A Learner's first pick of Avatar and accent colour, before their first Today: a live profile card on one side, the
 * pictures and colours on the other. Done saves both; the Parent can change them later.
 */
export function AvatarPick({ learner, onDone }: { learner: LoggedInLearner; onDone: (learner: LoggedInLearner) => void }) {
  const [avatar, setAvatar] = useState<AvatarId>();
  const [color, setColor] = useState<AccentColor>(learner.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!avatar) return;
    setSaving(true);
    const res = await api.pickAvatar({ avatar, color }).catch(() => undefined);
    setSaving(false);
    if (res?.ok) return onDone(await res.json());
    setError(text.genericError);
  }

  return (
    <main className="split screen-enter">
      <section className="split-start">
        <div className="wordmark">
          <TutorMark size={36} mood="happy" /> {text.session.tutor}
        </div>
        <span className="eyebrow">{text.avatarPick.eyebrow}</span>
        <h1 className="display">{text.avatarPick.heading(learner.name)}</h1>
        <p className="lead">{text.avatarPick.intro}</p>
        <div className="name-card" aria-hidden>
          <Avatar avatar={avatar ?? null} color={color} name={learner.name} size={88} />
          <strong>{learner.name}</strong>
        </div>
      </section>
      <form className="split-end avatar-pick" onSubmit={save}>
        <fieldset>
          <legend className="h3">{text.avatarPick.pictureHeading}</legend>
          <div className="avatar-grid">
            {AVATARS.map((id) => (
              <label key={id} className="avatar-option">
                <input type="radio" name="avatar" value={id} checked={avatar === id} onChange={() => setAvatar(id)} />
                <Avatar avatar={id} color={color} name={text.avatars[id]} size={52} muted={avatar !== id} />
                <span className="visually-hidden">{text.avatars[id]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="h3">{text.avatarPick.colorHeading}</legend>
          <div className="swatches">
            {ACCENT_COLORS.map((c) => (
              <label key={c} className="swatch">
                <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} />
                <span className={`swatch-fill accent-${c}`} aria-hidden />
                <span className="visually-hidden">{text.colors[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-warm">{error}</p>}
        <div className="avatar-pick-done">
          <Button type="submit" disabled={!avatar || saving}>
            {text.avatarPick.done} <ArrowIcon size={18} />
          </Button>
        </div>
      </form>
    </main>
  );
}
