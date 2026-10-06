import { useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "../../shared/auth";
import { api } from "../api";
import { Button, Field, Tag } from "../components/ui";
import { Wordmark } from "../components/Wordmark";
import { text } from "../text";

/** First-time setup: the Parent sets their password. A split screen like the profile picker, with the denser controls. */
export function SetupForm({ onDone }: { onDone: () => void }) {
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
    <main className="split dense screen-enter">
      <section className="split-start">
        <Wordmark />
        <Tag>{text.parentArea.heading}</Tag>
        <h1 className="display">{text.setup.heading}</h1>
        <p className="lead">{text.setup.intro}</p>
      </section>
      <form className="split-end" onSubmit={submit}>
        <Field label={text.setup.passwordLabel}>
          <input type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={text.setup.confirmLabel} hint={text.setup.hint}>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && (
          <p className="text-warm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit">{text.setup.submit}</Button>
      </form>
    </main>
  );
}
