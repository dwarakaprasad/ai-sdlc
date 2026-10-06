import { useEffect, useState, type CSSProperties } from "react";
import { PATH_STATES, type LearningPath, type PathNode } from "../../shared/api";
import { api } from "../api";
import { BackIcon, CheckIcon, ParentIcon, SkipIcon, TrophyIcon } from "../components/icons";
import { TutorMark } from "../components/TutorMark";
import { Button, Card } from "../components/ui";
import { text } from "../text";

/**
 * A Subject's Learning Path: a side panel with the Term, a progress ring and a legend, beside the Term's Units as timeline
 * lists. Only the current node can be started, with the Subject's current Goal; the Goal queue, not the Path, decides
 * what comes next, so nothing else on the Path can be jumped to.
 */
export function LearningPathScreen({
  subjectKey,
  currentGoalId,
  onStart,
  onBack,
}: {
  subjectKey: string;
  /** The Subject's current Goal, which the current node starts; none while it's with the Parent. */
  currentGoalId: number | undefined;
  onStart: (goalId: number) => void;
  onBack: () => void;
}) {
  const [path, setPath] = useState<LearningPath | null>();
  const [error, setError] = useState<string>();
  useEffect(() => void api.learningPath(subjectKey).then((p) => setPath(p ?? null), () => setError(text.genericError)), [subjectKey]);

  if (error) return <p className="text-warm">{error}</p>;
  if (path === undefined) return <p className="muted">{text.loading}</p>;
  if (path === null) {
    return (
      <Card className="home-empty">
        <TutorMark size={56} mood="resting" />
        <p>{text.learningPath.noPath}</p>
      </Card>
    );
  }

  const nodes = path.units.flatMap((unit) => unit.nodes);
  const met = nodes.filter((node) => node.state === "met").length;
  return (
    <div className="path">
      <aside className="path-side">
        <Button kind="quiet" onClick={onBack}>
          <BackIcon size={16} /> {text.learningPath.back}
        </Button>
        <span className="eyebrow">{path.termName}</span>
        <h1 className="h1">{path.subjectName}</h1>
        <div
          className="path-ring"
          role="meter"
          aria-label={text.learningPath.ring(met, nodes.length)}
          aria-valuemin={0}
          aria-valuemax={nodes.length}
          aria-valuenow={met}
          style={{ "--done": nodes.length === 0 ? 0 : met / nodes.length } as CSSProperties}
        >
          <strong>{met}</strong>
          <small>{text.learningPath.ringOf(nodes.length)}</small>
        </div>
        <ul className="path-legend" aria-label={text.learningPath.legendLabel}>
          {PATH_STATES.map((state) => (
            <li key={state}>
              <i className={state} aria-hidden /> {text.learningPath.states[state]}
            </li>
          ))}
        </ul>
      </aside>
      <div className="path-units">
        {path.units.map((unit, u) => (
          <section key={unit.key} className="path-unit" aria-labelledby={`unit-${u}`}>
            <header>
              <span className="eyebrow">{text.learningPath.unit(u + 1)}</span>
              <h2 className="h3" id={`unit-${u}`}>
                {unit.title}
              </h2>
            </header>
            <ol>
              {unit.nodes.map((node, n) => (
                <PathStep key={`${node.kind}:${node.key}`} node={node} label={node.kind === "unit-test" ? text.learningPath.unitTest : text.learningPath.lesson(u + 1, n + 1)}>
                  {node.state === "current" && currentGoalId !== undefined ? (
                    <Button onClick={() => onStart(currentGoalId)}>{text.learningPath.start}</Button>
                  ) : (
                    <span className="path-state">{text.learningPath.states[node.state]}</span>
                  )}
                </PathStep>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

/** One Lesson or Unit Test on the timeline: its mark, what it is, and its state or Start. */
function PathStep({ node, label, children }: { node: PathNode; label: string; children: React.ReactNode }) {
  return (
    <li className={`path-step ${node.state} ${node.kind}`} aria-current={node.state === "current" ? "step" : undefined}>
      <span className="path-dot" aria-hidden>
        {node.state === "met" && <CheckIcon size={14} />}
        {node.state === "with-parent" && <ParentIcon size={14} />}
        {node.state === "skipped" && <SkipIcon size={12} />}
        {node.kind === "unit-test" && node.state === "ahead" && <TrophyIcon size={14} />}
      </span>
      <span className="path-text">
        <small>{label}</small>
        <strong>{node.title}</strong>
      </span>
      {children}
    </li>
  );
}
