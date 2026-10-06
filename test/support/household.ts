import { join } from "node:path";
import { inFolder, validCurriculum, writeFixture } from "./curriculumFixture";
import { readSse } from "./sse";
import { createTestApp } from "./testApp";

export const ratios = "math/term-1/unit-1/lesson-1";

/** validCurriculum with Tutoring Instructions for Math. */
const curriculum = {
  ...validCurriculum,
  "math/tutoring.md": "Use tape diagrams to show ratios.",
};

/**
 * An install with a logged-in Parent and one logged-in Learner, Ada (grade 6),
 * whose current Goal is "Understanding ratios". `now` fixes the clock. Ada's Curriculum is in `curriculumFolder`, for tests that edit it.
 */
export async function household(options: { now?: () => Date } = {}) {
  const curriculaDir = writeFixture(inFolder("grade-6", curriculum));
  const { client, llm } = createTestApp({ curriculaDir, now: options.now });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const ada = (await (await parent("/api/parent/learners", { name: "Ada", grade: "6", curriculumId: "grade-6" })).json()).id as number;
  const goalId = (await (await parent(`/api/parent/learners/${ada}/goals`, { lessonKey: ratios, targetDate: "2026-12-01" })).json())
    .id as number;
  const learner = client();
  await learner("/api/learner/login", { learnerId: ada });

  /** Taps the Goal card: starts a Session, or resumes the open one. */
  const openSession = async (goal = goalId) => learner(`/api/learner/goals/${goal}/session`, {});
  /** One turn of the Session: the Learner's message (none for the Explanation) in, the streamed Tutor reply out. */
  const turn = async (sessionId: number, message?: string) =>
    readSse(await learner(`/api/learner/sessions/${sessionId}/turn`, message === undefined ? {} : { message }));
  /** Opens the Session and hears the Explanation. */
  const startLesson = async (explanation = "A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?") => {
    const session = await (await openSession()).json();
    llm.replyWith(explanation);
    await turn(session.id);
    return session.id as number;
  };
  const parentGoals = async () => (await parent(`/api/parent/learners/${ada}/goals`)).json();
  const curriculumFolder = join(curriculaDir, "grade-6");
  return { client, parent, learner, llm, ada, goalId, openSession, turn, startLesson, parentGoals, curriculumFolder };
}
