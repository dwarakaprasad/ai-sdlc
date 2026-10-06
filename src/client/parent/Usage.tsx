import { useEffect, useState } from "react";
import type { DailyUsage } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";

/** The Tutor's token use, a row per day. */
export function Usage() {
  const [days, setDays] = useState<DailyUsage[]>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.usage().then(setDays, () => setError(text.genericError)), []);

  if (error) return <p className="text-warm">{error}</p>;
  if (!days) return <p className="muted">{text.loading}</p>;
  const columns = text.usage.columns;
  return (
    <>
      <h1 className="h2">{text.usage.heading}</h1>
      {days.length === 0 ? (
        <p className="muted">{text.usage.none}</p>
      ) : (
        <div className="usage-wrap">
          <table className="usage-table">
            <thead>
              <tr>
                <th scope="col">{columns.date}</th>
                <th scope="col">{columns.input}</th>
                <th scope="col">{columns.output}</th>
                <th scope="col">{columns.calls}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{d.date}</th>
                  <td>{d.inputTokens.toLocaleString()}</td>
                  <td>{d.outputTokens.toLocaleString()}</td>
                  <td>{d.calls.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
