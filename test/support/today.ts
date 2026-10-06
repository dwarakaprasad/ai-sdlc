import type { GoalCard, LearnerToday } from "../../src/shared/api";

type Request = (path: string) => Promise<Response>;

/** The Goal cards on a Learner's home screen, in the order it shows them; a Subject with the Parent, or with nothing to do, has none. */
export async function goalCards(learner: Request): Promise<GoalCard[]> {
  const today = (await (await learner("/api/learner/goals")).json()) as LearnerToday;
  return today.subjects.flatMap((subject) => (subject.card ? [subject.card] : []));
}
