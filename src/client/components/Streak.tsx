import type { Streak } from "../../shared/api";
import { text } from "../text";
import { FlameIcon } from "./icons";

/** The Streak's length beside a flame, for the top bar. */
export function StreakChip({ days }: { days: number }) {
  return (
    <span className="streak-chip" role="img" aria-label={text.streak.chipLabel(days)}>
      <FlameIcon size={18} /> {days}
    </span>
  );
}

/**
 * The Streak with its last seven days: worked days filled, weekend rest days dashed, today ringed until it counts.
 * At 0 it invites a new Streak, never mourns a lost one.
 */
export function StreakWeek({ streak }: { streak: Streak }) {
  return (
    <div className="streak-week">
      {streak.days > 0 ? (
        <div className="achievement">
          <span className="eyebrow">{text.streak.heading}</span>
          <strong className="achievement-streak">
            <FlameIcon size={18} /> {text.streak.days(streak.days)}
          </strong>
        </div>
      ) : (
        <div>
          <span className="eyebrow">{text.streak.heading}</span>
          <strong className="streak-start">{text.streak.startNew}</strong>
        </div>
      )}
      <ol className="streak-days" aria-label={text.streak.weekLabel}>
        {streak.week.map(({ date, state }) => (
          <li key={date} className={`streak-day streak-${state}`}>
            <span aria-hidden />
            <small aria-hidden>{text.streak.weekdayInitial(date)}</small>
            <span className="visually-hidden">{text.streak.day(date, state)}</span>
          </li>
        ))}
      </ol>
      <p className="muted streak-note">{text.streak.weekendNote}</p>
    </div>
  );
}
