import { useEffect, useState, type FormEvent } from "react";
import type { Goal, Learner, LessonOption } from "../../shared/api";
import { api } from "../api";
import { text } from "../text";

/**
 * A Learner's Goals in the Parent area: each Goal's Target Date to edit, moving it up or down its Subject's queue
 * and skipping it; a form to set a new Goal, at the end of its Subject's queue or before another of its Goals;
 * and a form to spread Target Dates over a Term.
 */
export function Goals({ learner }: { learner: Learner }) {
  const [goals, setGoals] = useState<Goal[]>();
  const [lessons, setLessons] = useState<LessonOption[]>();
  const [lessonKey, setLessonKey] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [beforeGoalId, setBeforeGoalId] = useState("");
  const [termKey, setTermKey] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [error, setError] = useState<string>();

  const refresh = () =>
    Promise.all([api.goals(learner.id), api.lessons(learner.id)]).then(([g, l]) => {
      setGoals(g);
      setLessons(l);
      setLessonKey((key) => key || (l[0]?.key ?? ""));
      setTermKey((key) => key || (l[0]?.termKey ?? ""));
    }, () => setError(text.genericError));
  // Re-read when the Learner is edited, since a new Curriculum means new Lessons.
  useEffect(() => void refresh(), [learner.id, learner.curriculumId]);

  /** Re-reads the Goals once `res` went through, or shows what went wrong. Returns whether it went through. */
  async function settle(res: Response): Promise<boolean> {
    if (res.ok) return (setError(undefined), void refresh(), true);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(text.goals.errors[body.error ?? ""] ?? text.genericError);
    return false;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = { lessonKey, targetDate, ...(beforeGoalId && { beforeGoalId: Number(beforeGoalId) }) };
    if (await settle(await api.createGoal(learner.id, input))) (setTargetDate(""), setBeforeGoalId(""));
  }

  async function spread(e: FormEvent) {
    e.preventDefault();
    if (await settle(await api.spreadTargetDates(learner.id, { termKey, termEndDate }))) setTermEndDate("");
  }

  /** Swaps `goal` with its neighbour `by` places along its Subject's queue. */
  async function move(goal: Goal, by: -1 | 1) {
    const ids = goals!.filter((g) => g.subjectKey === goal.subjectKey).map((g) => g.id);
    const from = ids.indexOf(goal.id);
    [ids[from], ids[from + by]] = [ids[from + by]!, ids[from]!];
    await settle(await api.reorderGoals(learner.id, { goalIds: ids }));
  }

  if (!goals || !lessons) return error ? <p className="error">{error}</p> : <p>{text.loading}</p>;
  // A new Goal can only be inserted into its own Subject's queue.
  const lessonSubject = lessons.find((l) => l.key === lessonKey)?.subjectKey;
  const insertPoints = goals.filter((g) => g.subjectKey === lessonSubject);
  const terms = [...new Map(lessons.map((l) => [l.termKey, l])).values()];
  return (
    <>
      <h4>{text.goals.heading}</h4>
      {goals.length === 0 && <p className="hint">{text.goals.none}</p>}
      <ul className="goals">
        {goals.map((goal, i) => {
          const sameSubject = (other: Goal | undefined) => other?.subjectKey === goal.subjectKey;
          return (
            <li key={goal.id}>
              {text.goals.goal(goal.subjectName, text.goalTitle(goal.kind, goal.title), goal.targetDate)}
              {text.goals.status[goal.status] && ` · ${text.goals.status[goal.status]}`}
              {goal.overdue && <span className="overdue"> · {text.goals.overdue}</span>}
              {goal.orphaned && <span className="overdue"> · {text.goals.orphaned}</span>}
              <span className="goal-actions">
                <input
                  type="date"
                  aria-label={text.goals.editTargetDate(goal.title)}
                  // Keyed by the date so a re-read (after spreading, say) shows the new one.
                  key={goal.targetDate}
                  defaultValue={goal.targetDate}
                  onBlur={async (e) => {
                    const date = e.target.value;
                    if (date && date !== goal.targetDate) await settle(await api.editTargetDate(learner.id, goal.id, date));
                  }}
                />
                <button type="button" disabled={!sameSubject(goals[i - 1])} onClick={() => void move(goal, -1)}>
                  {text.goals.moveUp}
                </button>
                <button type="button" disabled={!sameSubject(goals[i + 1])} onClick={() => void move(goal, 1)}>
                  {text.goals.moveDown}
                </button>
                {goal.status === "flagged" && (
                  <>
                    <button type="button" onClick={async () => void (await settle(await api.retryGoal(learner.id, goal.id)))}>
                      {text.goals.retry}
                    </button>
                    {!goal.orphaned && (
                      <button type="button" onClick={async () => void (await settle(await api.markGoalMet(learner.id, goal.id)))}>
                        {text.goals.markMet}
                      </button>
                    )}
                  </>
                )}
                {(goal.status === "active" || goal.status === "flagged") && (
                  <button type="button" onClick={async () => void (await settle(await api.skipGoal(learner.id, goal.id)))}>
                    {text.goals.skip}
                  </button>
                )}
              </span>
              {goal.orphaned && <OrphanedGoalActions learnerId={learner.id} goal={goal} lessons={lessons} settle={settle} />}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
      {lessons.length === 0 ? (
        <p className="hint">{text.goals.noLessons}</p>
      ) : (
        <>
          <form onSubmit={submit}>
            <label>
              {text.goals.lessonLabel}
              <select value={lessonKey} onChange={(e) => (setLessonKey(e.target.value), setBeforeGoalId(""))}>
                {[...new Set(lessons.map((l) => l.subjectName))].map((subjectName) => (
                  <optgroup key={subjectName} label={subjectName}>
                    {lessons
                      .filter((l) => l.subjectName === subjectName)
                      .map((l) => (
                        <option key={l.key} value={l.key}>
                          {text.goals.lessonOption(l.unitTitle, l.title)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              {text.goals.targetDateLabel}
              <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
            {insertPoints.length > 0 && (
              <label>
                {text.goals.positionLabel}
                <select value={beforeGoalId} onChange={(e) => setBeforeGoalId(e.target.value)}>
                  <option value="">{text.goals.atEnd}</option>
                  {insertPoints.map((g) => (
                    <option key={g.id} value={g.id}>
                      {text.goals.before(g.title)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit">{text.goals.add}</button>
          </form>
          <h4>{text.goals.spreadHeading}</h4>
          <p className="hint">{text.goals.spreadHint}</p>
          <form onSubmit={spread}>
            <label>
              {text.goals.termLabel}
              <select value={termKey} onChange={(e) => setTermKey(e.target.value)}>
                {terms.map((l) => (
                  <option key={l.termKey} value={l.termKey}>
                    {text.goals.termOption(l.subjectName, l.termName)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text.goals.termEndDateLabel}
              <input type="date" required value={termEndDate} onChange={(e) => setTermEndDate(e.target.value)} />
            </label>
            <button type="submit">{text.goals.spread}</button>
          </form>
        </>
      )}
    </>
  );
}

/** Re-points an orphaned Goal to a Lesson of the Curriculum (a Unit Test can only be removed here), or removes it. */
function OrphanedGoalActions({
  learnerId,
  goal,
  lessons,
  settle,
}: {
  learnerId: number;
  goal: Goal;
  lessons: LessonOption[];
  settle: (res: Response) => Promise<boolean>;
}) {
  const [lessonKey, setLessonKey] = useState(lessons[0]?.key ?? "");

  async function remove() {
    if (!window.confirm(text.goals.confirmRemove(goal.title))) return;
    await settle(await api.removeGoal(learnerId, goal.id));
  }

  return (
    <div className="orphaned">
      <p className="hint">{text.goals.orphanedHint}</p>
      {goal.kind === "lesson" && lessons.length > 0 && (
        <form onSubmit={async (e) => (e.preventDefault(), void (await settle(await api.repointGoal(learnerId, goal.id, { lessonKey }))))}>
          <label>
            {text.goals.repointLabel(goal.title)}
            <select value={lessonKey} onChange={(e) => setLessonKey(e.target.value)}>
              {lessons.map((l) => (
                <option key={l.key} value={l.key}>
                  {`${l.subjectName} · ${text.goals.lessonOption(l.unitTitle, l.title)}`}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{text.goals.repoint}</button>
        </form>
      )}
      <button type="button" onClick={() => void remove()}>
        {text.goals.remove}
      </button>
    </div>
  );
}
