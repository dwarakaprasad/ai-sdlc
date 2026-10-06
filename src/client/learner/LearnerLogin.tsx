import { useEffect, useState } from "react";
import type { LearnerProfile } from "../../shared/api";
import { api } from "../api";
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
