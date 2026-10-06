import { useEffect, useState } from "react";
import type { CurriculumSummary } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";

export function Curricula() {
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
