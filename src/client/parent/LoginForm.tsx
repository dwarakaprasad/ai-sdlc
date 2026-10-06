import { useState, type FormEvent } from "react";
import { api } from "../api";
import { BackIcon } from "../components/icons";
import { Button, Field, Tag } from "../components/ui";
import { Wordmark } from "../components/Wordmark";
import { text } from "../text";

/** The Parent's login, reached from the profile picker: the same split screen, with the denser controls. */
export function LoginForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await api.loginParent(password);
    if (res.ok) onDone();
    else setError(res.status === 401 ? text.login.wrongPassword : text.genericError);
  }

  return (
    <main className="split dense screen-enter">
      <section className="split-start">
        <Wordmark />
        <Tag>{text.parentArea.heading}</Tag>
        <h1 className="display">{text.login.heading}</h1>
      </section>
      <form className="split-end" onSubmit={submit}>
        <Field label={text.login.passwordLabel}>
          <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p className="text-warm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit">{text.login.submit}</Button>
        <Button kind="quiet" className="split-aside" onClick={onBack}>
          <BackIcon size={16} /> {text.login.back}
        </Button>
      </form>
    </main>
  );
}
