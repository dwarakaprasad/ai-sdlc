import { useEffect, useState } from "react";
import type { LearnerProfile } from "../../shared/api";
import { api } from "../api";
import { ArrowIcon, LockIcon } from "../components/icons";
import { Button, Field, Initial } from "../components/ui";
import { Wordmark } from "../components/Wordmark";
import { text } from "../text";

export function LearnerLogin({ onDone, onParent }: { onDone: () => void; onParent: () => void }) {
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
      <main className="split screen-enter">
        <section className="split-start">
          <Wordmark />
          <Initial name={chosen.name} size={88} />
          <h1 className="display">{text.learnerLogin.pinHeading(chosen.name)}</h1>
        </section>
        <form
          className="split-end"
          onSubmit={(e) => {
            e.preventDefault();
            void login(chosen, pin);
          }}
        >
          <Field label={text.learnerLogin.pinLabel}>
            <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
          </Field>
          {error && <p className="text-warm">{error}</p>}
          <Button type="submit">
            {text.learnerLogin.submit} <ArrowIcon size={18} />
          </Button>
          <Button kind="quiet" className="split-aside" onClick={() => (setChosen(undefined), setPin(""), setError(undefined))}>
            {text.learnerLogin.back}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="split screen-enter">
      <section className="split-start">
        <Wordmark />
        <h1 className="display">{text.learnerLogin.heading}</h1>
        <p className="lead">{text.learnerLogin.intro}</p>
      </section>
      <section className="split-end">
        {!profiles && !error && <p className="muted">{text.loading}</p>}
        {profiles?.length === 0 && <p className="muted">{text.learnerLogin.noProfiles}</p>}
        {profiles?.map((profile) => (
          <button key={profile.id} type="button" className="profile-row" onClick={() => choose(profile)}>
            <Initial name={profile.name} />
            <span className="profile-name">{profile.name}</span>
            {profile.hasPin ? (
              <span className="profile-pin">
                <LockIcon size={16} /> {text.learnerLogin.hasPin}
              </span>
            ) : (
              <ArrowIcon />
            )}
          </button>
        ))}
        {error && <p className="text-warm">{error}</p>}
        <Button kind="quiet" className="split-aside" onClick={onParent}>
          {text.learnerLogin.parentLink} <ArrowIcon size={16} />
        </Button>
      </section>
    </main>
  );
}
