import type { Page } from "@playwright/test";
import { expect, setUpHousehold, test, type ScriptedLlm } from "./fixtures";

/** The Learning Objectives of "Understanding ratios" in the fixture Curriculum. */
const WRITE_A_RATIO = "Write a ratio to describe two quantities.";
const RATIO_LANGUAGE = 'Use ratio language such as "for every".';

/** Ten questions (the shortest quiz the app accepts): five number questions on writing a ratio, then five multiple-choice ones on ratio language. */
const QUIZ = [
  ...[1, 2, 3, 4, 5].map((n) => ({
    type: "number",
    prompt: `There are ${n} cats for every dog. How many cats are there for 1 dog?`,
    choices: [],
    answer: String(n),
    explanation: `For every dog there are ${n} cats.`,
    objective: WRITE_A_RATIO,
  })),
  ...[6, 7, 8, 9, 10].map((n) => ({
    type: "multiple-choice",
    prompt: `Question ${n}: which words describe a ratio?`,
    choices: ["for every", "plus", "minus"],
    answer: "for every",
    explanation: '"For every" compares one amount with another.',
    objective: RATIO_LANGUAGE,
  })),
];

/** Logs Ada in, hears the Explanation, passes the Understanding Check and starts the Lesson Quiz. */
async function startQuiz(page: Page, llm: ScriptedLlm) {
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ada" }).click();
  await llm.replyWith("A ratio compares two quantities. What is the ratio of 4 cats to 5 dogs?");
  await page.getByRole("button", { name: "Continue with Jarvis" }).click();
  await expect(page.getByRole("list", { name: "Conversation" })).toContainText("4 cats to 5 dogs?");
  // The lesson panel shows the Lesson's Learning Objectives beside the conversation.
  await expect(page.getByRole("complementary")).toContainText(WRITE_A_RATIO);

  await llm.decideWith({ verdict: "advance" });
  await llm.replyWith("Well done! A short quiz comes next.");
  await page.getByLabel("Your answer").fill("4 to 5");
  await page.getByRole("button", { name: "Send" }).click();
  await llm.decideWith({ questions: QUIZ });
  await page.getByRole("button", { name: "Start the Quiz" }).click();
}

/** Answers the question showing, then moves on. */
async function answer(page: Page, n: number, given: string) {
  await expect(page.getByText(`Question ${n} of ${QUIZ.length}`)).toBeVisible();
  const question = QUIZ[n - 1]!;
  if (question.type === "number") await page.getByLabel("Your answer").fill(given);
  else await page.getByRole("radio", { name: given }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(given === question.answer ? "Correct." : "Not quite.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("a Learner sees Correct or Not quite with the right answer, resumes mid-Quiz, and after a failed attempt sees what they missed", async ({
  page,
  llm,
}) => {
  await startQuiz(page, llm);

  // Check only works once there's an answer.
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeDisabled();

  // A right answer: Correct, with its one-line explanation.
  await page.getByLabel("Your answer").fill("1");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Correct.")).toBeVisible();
  await expect(page.getByText("For every dog there are 1 cats.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // A wrong answer: Not quite, with the right answer and the explanation.
  await page.getByLabel("Your answer").fill("7");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Not quite.")).toBeVisible();
  await expect(page.getByText("Answer: 2")).toBeVisible();
  await expect(page.getByText("For every dog there are 2 cats.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Leaving and coming back picks up the same attempt at the next question.
  await expect(page.getByText(`Question 3 of ${QUIZ.length}`)).toBeVisible();
  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByRole("button", { name: "Continue with Jarvis" }).click();
  await expect(page.getByText(`Question 3 of ${QUIZ.length}`)).toBeVisible();

  for (const n of [3, 4, 5]) await answer(page, n, QUIZ[n - 1]!.answer);
  // A wrong multiple-choice pick: the right option is marked, and so is the pick.
  await expect(page.getByText(`Question 6 of ${QUIZ.length}`)).toBeVisible();
  await page.getByRole("radio", { name: "plus" }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Not quite.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "for every (the right answer)" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "plus" })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  for (const n of [7, 8, 9, 10]) await answer(page, n, QUIZ[n - 1]!.answer);

  // The score, each question marked, the attempt number, and both missed Learning Objectives.
  await expect(page.getByLabel("You got 8 out of 10 right.")).toBeVisible();
  await expect(page.getByText("Quiz 1 of 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Not quite:" })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Let's look again at the parts you missed." })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: WRITE_A_RATIO })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: RATIO_LANGUAGE })).toBeVisible();

  // Going over them with Jarvis re-teaches, then offers a new quiz.
  await llm.replyWith("Let's look at those again: 2 cats for every dog is 2:1. Ready for a new quiz?");
  await page.getByRole("button", { name: "Go over it with Jarvis" }).click();
  await expect(page.getByRole("list", { name: "Conversation" })).toContainText("2 cats for every dog is 2:1.");
  await expect(page.getByRole("button", { name: "Start the new Quiz" })).toBeVisible();
});
