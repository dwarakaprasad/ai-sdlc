import { expect, test } from "./fixtures";

const EXPLANATION =
  "A ratio compares two quantities. If there are 2 cats for every 3 dogs, the ratio of cats to dogs is 2 to 3. What is the ratio of 4 cats to 5 dogs?";

/** The Learning Objectives of "Understanding ratios" in the fixture Curriculum; a generated quiz must test each one. */
const OBJECTIVES = ["Write a ratio to describe two quantities.", 'Use ratio language such as "for every".'];

/** Ten number questions on "Understanding ratios" (the shortest quiz the app accepts), as the Tutor's quiz generation returns them. */
const QUIZ = Array.from({ length: 10 }, (_, i) => ({
  type: "number",
  prompt: `There are ${i + 1} cats for every dog. How many cats are there for 1 dog?`,
  choices: [],
  answer: String(i + 1),
  explanation: `For every dog there are ${i + 1} cats.`,
  objective: OBJECTIVES[i % OBJECTIVES.length],
}));

/** A YYYY-MM-DD date `days` from today. */
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("a Parent sets up a Learner and Goal; the Learner chats with the Tutor, passes the Lesson Quiz and meets the Goal", async ({ page, tutor }) => {
  await page.goto("/");

  // The Parent sets the password on a fresh install.
  await expect(page.getByRole("heading", { name: "Welcome to Home Tutor" })).toBeVisible();
  await page.getByLabel("Parent password").fill("correct horse");
  await page.getByLabel("Confirm password").fill("correct horse");
  await page.getByRole("button", { name: "Set password" }).click();

  // …adds a Learner…
  await expect(page.getByRole("heading", { name: "Parent area" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("textbox", { name: "Grade" }).fill("6");
  await page.getByRole("button", { name: "Add Learner" }).click();
  const ada = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Ada" }) });
  await expect(ada).toBeVisible();

  // …and a Goal: the first Lesson of the fixture Curriculum.
  await ada.getByRole("combobox", { name: "Lesson" }).selectOption({ label: "Ratios · Understanding ratios" });
  await ada.getByLabel("Target Date", { exact: true }).fill(daysFromNow(30));
  await ada.getByRole("button", { name: "Set Goal" }).click();
  await expect(ada.getByText(/Math: Understanding ratios, by/)).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();

  // The Learner picks their profile and starts the Goal.
  await expect(page.getByRole("heading", { name: "Who's learning today?" })).toBeVisible();
  await page.getByRole("button", { name: "Ada" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();
  const goal = page.getByRole("article").filter({ hasText: "Understanding ratios" });
  await tutor.replyWith(EXPLANATION, { pieceDelayMs: 100 });
  await goal.getByRole("button", { name: "Start" }).click();

  // The Explanation streams in: its start shows before its end has arrived.
  await expect(page.getByRole("heading", { name: "Understanding ratios" })).toBeVisible();
  const transcript = page.getByRole("list");
  await expect(transcript).toContainText("A ratio compares");
  await expect(transcript).not.toContainText("4 cats to 5 dogs?");
  await expect(transcript).toContainText(EXPLANATION);

  // The Learner answers the Understanding Check and the Tutor moves on to the Quiz.
  await tutor.decideWith({ verdict: "advance" });
  await tutor.replyWith("Well done! 4 to 5 is right. A short quiz comes next.");
  await page.getByLabel("Your answer").fill("4 to 5");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(transcript).toContainText("Well done! 4 to 5 is right.");

  // The Lesson Quiz, every answer right.
  await tutor.decideWith({ questions: QUIZ });
  await page.getByRole("button", { name: "Start the Quiz" }).click();
  for (const [i, question] of QUIZ.entries()) {
    await expect(page.getByText(`Question ${i + 1} of ${QUIZ.length}`)).toBeVisible();
    await page.getByLabel("Your answer").fill(question.answer);
    await page.getByRole("button", { name: "Check my answer" }).click();
    await expect(page.getByText("That's right!")).toBeVisible();
    await page.getByRole("button", { name: i + 1 < QUIZ.length ? "Next question" : "See my score" }).click();
  }

  // Goal met.
  await expect(page.getByText(`You got ${QUIZ.length} out of ${QUIZ.length} right.`)).toBeVisible();
  await expect(page.getByText("You've mastered this Lesson. Goal met!")).toBeVisible();
  await page.getByRole("button", { name: "Back to my Goals" }).click();
  // The met Goal has gone and its Subject has moved on to the next Lesson.
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Understanding ratios" })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: "Equivalent ratios" })).toBeVisible();
});
