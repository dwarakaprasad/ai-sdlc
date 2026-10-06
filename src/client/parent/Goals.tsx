import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { needsAttention, type Goal, type Learner, type LessonOption } from "../../shared/api";
import { api } from "../api";
import { Button, Card, Field, Segmented, Tag } from "../components/ui";
import { text } from "../text";

type Filter = "all" | "attention";

/**
 * A Learner's Goals in the Parent area: a table grouped by Subject, each Subject's queue in order, filtered to those needing
 * attention if the Parent likes. Each Goal opens to edit its Target Date, move it up or down its queue, skip it, and resolve
 * it when Flagged or Orphaned. Below, a form to set a new Goal (at the end of its Subject's queue or before another of its
 * Goals) and one to spread Target Dates over a Term. `onChange` hears of every change that went through.
 */
export function Goals({ learner, onChange }: { learner: Learner; onChange: () => void }) {
  const [goals, setGoals] = useState<Goal[]>();
  const [lessons, setLessons] = useState<LessonOption[]>();
  const [filter, setFilter] = useState<Filter>("all");
  /** The Goal opened to act on. */
  const [openId, setOpenId] = useState<number>();
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
    if (res.ok) return (setError(undefined), void refresh(), onChange(), true);
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

  if (!goals || !lessons) return error ? <p className="text-warm">{error}</p> : <p className="muted">{text.loading}</p>;
  // A new Goal can only be inserted into its own Subject's queue.
  const lessonSubject = lessons.find((l) => l.key === lessonKey)?.subjectKey;
  const insertPoints = goals.filter((g) => g.subjectKey === lessonSubject);
  const terms = [...new Map(lessons.map((l) => [l.termKey, l])).values()];
  const attentionCount = goals.filter(needsAttention).length;
  const shown = filter === "attention" ? goals.filter(needsAttention) : goals;
  // The Goals come each Subject's queue in order, so a Subject's rows are already together.
  const subjects = [...new Map(shown.map((g) => [g.subjectKey, g.subjectName])).entries()];
  /** Whether `goal` has a neighbour `by` places along its Subject's whole queue, filtered out or not. */
  const canMove = (goal: Goal, by: -1 | 1) => goals[goals.indexOf(goal) + by]?.subjectKey === goal.subjectKey;
  return (
    <>
      <div className="goals-toolbar">
        <h2 className="h3">{text.goals.heading}</h2>
        <Segmented
          label={text.goals.filterLabel}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: text.goals.filterAll },
            { value: "attention", label: text.goals.filterAttention(attentionCount) },
          ]}
        />
      </div>
      {error && (
        <p className="text-warm" role="alert">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="muted goals-empty">{goals.length === 0 ? text.goals.none : text.goals.noneNeedAttention}</p>
      ) : (
        <div className="goal-table-wrap">
          <table className="goal-table">
            <thead>
              <tr>
                <th scope="col">{text.goals.columns.lesson}</th>
                <th scope="col">{text.goals.columns.goal}</th>
                <th scope="col">{text.goals.columns.target}</th>
                <th scope="col">{text.goals.columns.status}</th>
                <th scope="col">
                  <span className="visually-hidden">{text.goals.columns.actions}</span>
                </th>
              </tr>
            </thead>
            {subjects.map(([subjectKey, subjectName]) => (
              <tbody key={subjectKey}>
                <tr className="goal-group">
                  <th colSpan={5} scope="colgroup">
                    {subjectName}
                  </th>
                </tr>
                {shown
                  .filter((g) => g.subjectKey === subjectKey)
                  .map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      open={openId === goal.id}
                      onToggle={() => setOpenId(openId === goal.id ? undefined : goal.id)}
                    >
                      <GoalActions
                        learnerId={learner.id}
                        goal={goal}
                        lessons={lessons}
                        settle={settle}
                        canMoveUp={canMove(goal, -1)}
                        canMoveDown={canMove(goal, 1)}
                        onMove={(by) => void move(goal, by)}
                      />
                    </GoalRow>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {lessons.length === 0 ? (
        <p className="muted">{text.goals.noLessons}</p>
      ) : (
        <div className="goal-forms">
          <Card>
            <form onSubmit={submit}>
              <h3 className="h3">{text.goals.addHeading}</h3>
              <Field label={text.goals.lessonLabel}>
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
              </Field>
              <Field label={text.goals.targetDateLabel}>
                <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </Field>
              {insertPoints.length > 0 && (
                <Field label={text.goals.positionLabel}>
                  <select value={beforeGoalId} onChange={(e) => setBeforeGoalId(e.target.value)}>
                    <option value="">{text.goals.atEnd}</option>
                    {insertPoints.map((g) => (
                      <option key={g.id} value={g.id}>
                        {text.goals.before(g.title)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div>
                <Button type="submit">{text.goals.add}</Button>
              </div>
            </form>
          </Card>
          <Card>
            <form onSubmit={spread}>
              <h3 className="h3">{text.goals.spreadHeading}</h3>
              <p className="muted">{text.goals.spreadHint}</p>
              <Field label={text.goals.termLabel}>
                <select value={termKey} onChange={(e) => setTermKey(e.target.value)}>
                  {terms.map((l) => (
                    <option key={l.termKey} value={l.termKey}>
                      {text.goals.termOption(l.subjectName, l.termName)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={text.goals.termEndDateLabel}>
                <input type="date" required value={termEndDate} onChange={(e) => setTermEndDate(e.target.value)} />
              </Field>
              <div>
                <Button kind="outline" type="submit">
                  {text.goals.spread}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

/**
 * One Goal's row: its Lesson key, title, Target Date (with the days late when overdue) and status, and a button that opens
 * its actions in a row below. A Goal with the Parent (Flagged or Orphaned) offers Review; any other, Change.
 */
function GoalRow({ goal, open, onToggle, children }: { goal: Goal; open: boolean; onToggle: () => void; children: ReactNode }) {
  const withParent = goal.status === "flagged" || goal.orphaned;
  const detailId = `goal-${goal.id}-actions`;
  return (
    <>
      <tr className={`goal-row goal-row-${goal.status}`}>
        <td className="goal-key" title={goal.lessonKey}>
          {text.goals.shortKey(goal.lessonKey)}
        </td>
        <td>
          {text.goalTitle(goal.kind, goal.title)} {goal.orphaned && <Tag tone="warm">{text.goals.orphaned}</Tag>}
        </td>
        <td className={goal.overdue ? "goal-late" : undefined}>
          {text.goals.targetDate(goal.targetDate)}
          {goal.overdue && <small> · {text.goals.daysLate(goal.daysLate)}</small>}
        </td>
        <td>
          <span className={`goal-status status-${goal.status}`}>{text.goals.status[goal.status]}</span>
        </td>
        <td className="goal-act">
          <Button kind={withParent ? "outline" : "quiet"} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
            {withParent ? text.goals.review : text.goals.change}
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="goal-detail" id={detailId}>
          <td colSpan={5}>{children}</td>
        </tr>
      )}
    </>
  );
}

/** What the Parent can do with one Goal: its Target Date, its place in the queue, and resolving it. */
function GoalActions({
  learnerId,
  goal,
  lessons,
  settle,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  learnerId: number;
  goal: Goal;
  lessons: LessonOption[];
  settle: (res: Response) => Promise<boolean>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  const act = async (res: Promise<Response>) => void (await settle(await res));
  return (
    <div className="goal-actions">
      {goal.status === "flagged" && <p className="muted">{text.goals.flaggedHint}</p>}
      <div className="goal-actions-row">
        <Field label={text.goals.targetDateLabel}>
          <input
            type="date"
            aria-label={text.goals.editTargetDate(goal.title)}
            // Keyed by the date so a re-read (after spreading, say) shows the new one.
            key={goal.targetDate}
            defaultValue={goal.targetDate}
            onBlur={async (e) => {
              const date = e.target.value;
              if (date && date !== goal.targetDate) await settle(await api.editTargetDate(learnerId, goal.id, date));
            }}
          />
        </Field>
        <Button kind="outline" disabled={!canMoveUp} onClick={() => onMove(-1)}>
          {text.goals.moveUp}
        </Button>
        <Button kind="outline" disabled={!canMoveDown} onClick={() => onMove(1)}>
          {text.goals.moveDown}
        </Button>
        {goal.status === "flagged" && (
          <>
            <Button onClick={() => act(api.retryGoal(learnerId, goal.id))}>{text.goals.retry}</Button>
            {!goal.orphaned && (
              <Button kind="outline" onClick={() => act(api.markGoalMet(learnerId, goal.id))}>
                {text.goals.markMet}
              </Button>
            )}
          </>
        )}
        {(goal.status === "active" || goal.status === "flagged") && (
          <Button kind="outline" onClick={() => act(api.skipGoal(learnerId, goal.id))}>
            {text.goals.skip}
          </Button>
        )}
      </div>
      {goal.orphaned && <OrphanedGoalActions learnerId={learnerId} goal={goal} lessons={lessons} settle={settle} />}
    </div>
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
      <p className="muted">{text.goals.orphanedHint}</p>
      <div className="goal-actions-row">
        {goal.kind === "lesson" && lessons.length > 0 && (
          <form
            className="goal-actions-row"
            onSubmit={async (e) => (e.preventDefault(), void (await settle(await api.repointGoal(learnerId, goal.id, { lessonKey }))))}
          >
            <Field label={text.goals.repointLabel(goal.title)}>
              <select value={lessonKey} onChange={(e) => setLessonKey(e.target.value)}>
                {lessons.map((l) => (
                  <option key={l.key} value={l.key}>
                    {`${l.subjectName} · ${text.goals.lessonOption(l.unitTitle, l.title)}`}
                  </option>
                ))}
              </select>
            </Field>
            <Button kind="outline" type="submit">
              {text.goals.repoint}
            </Button>
          </form>
        )}
        <Button kind="quiet" onClick={() => void remove()}>
          {text.goals.remove}
        </Button>
      </div>
    </div>
  );
}
