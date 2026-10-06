import { useEffect, useState } from "react";
import type { CurriculumSummary } from "../../shared/api";
import { api } from "../api";
import { Card, Tag } from "../components/ui";
import { text } from "../text";

/** Every Curriculum folder: a valid one with its Subjects, an invalid one with each error's file and line. */
export function Curricula() {
  const [curricula, setCurricula] = useState<CurriculumSummary[]>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.curricula().then(setCurricula, () => setError(text.genericError)), []);

  if (error) return <p className="text-warm">{error}</p>;
  if (!curricula) return <p className="muted">{text.loading}</p>;
  return (
    <>
      <h1 className="h2">{text.curricula.heading}</h1>
      {curricula.length === 0 && <p className="muted">{text.curricula.none}</p>}
      <div className="curriculum-list">
        {curricula.map((curriculum) =>
          curriculum.valid ? (
            <Card key={curriculum.id} className="curriculum-card">
              <span className="eyebrow">{curriculum.id}</span>
              <h2 className="h3">{curriculum.title}</h2>
              <p className="muted">{text.curricula.details(curriculum.district, curriculum.grade, curriculum.schoolYear)}</p>
              <ul className="curriculum-subjects">
                {curriculum.subjects.map((s) => (
                  <li key={s.key}>{text.curricula.subject(s.name, s.lessonCount)}</li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card key={curriculum.id} className="curriculum-card curriculum-invalid">
              <div className="curriculum-head">
                <h2 className="h3">{curriculum.id}</h2>
                <Tag tone="warm">{text.curricula.errorCount(curriculum.errors.length)}</Tag>
              </div>
              <p>{text.curricula.invalid(curriculum.errors.length)}</p>
              <ul className="curriculum-errors">
                {curriculum.errors.map((e, i) => (
                  <li key={i}>
                    <code>{text.curricula.location(`${curriculum.id}/${e.file}`, e.line)}</code> {e.message}
                  </li>
                ))}
              </ul>
            </Card>
          ),
        )}
      </div>
    </>
  );
}
