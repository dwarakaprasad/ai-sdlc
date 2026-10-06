import { useEffect, useState } from "react";
import type { DailyUsage } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";

export function Usage() {
  const [days, setDays] = useState<DailyUsage[]>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.usage().then(setDays, () => setError(text.genericError)), []);

  if (error) return <p className="error">{error}</p>;
  if (!days) return <p>{text.loading}</p>;
  return (
    <section>
      <h2>{text.usage.heading}</h2>
      {days.length === 0 && <p>{text.usage.none}</p>}
      <ul>
        {days.map((d) => (
          <li key={d.date}>{text.usage.day(d.date, d.calls, d.inputTokens, d.outputTokens)}</li>
        ))}
      </ul>
    </section>
  );
}
