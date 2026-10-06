import { expect, flagCurrentGoal, setUpHousehold, test } from "./fixtures";

test("a Subject whose Goal is with the Parent stays on Today, saying so, with nothing to start", async ({ page, llm }) => {
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await flagCurrentGoal(page.request, llm, "Ada");

  await page.goto("/");
  await page.getByRole("button", { name: "Ada" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();

  const math = page.getByRole("listitem").filter({ hasText: "Math" });
  await expect(math).toContainText("With your Parent for now");
  await expect(math.getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Jarvis" })).toHaveCount(0);
  // The Term's progress still shows.
  await expect(math.getByRole("meter", { name: "Math Term 1: 0 of 5 Goals met" })).toBeVisible();
});

test("at 0, Today invites a new Streak; once the Learner sends the Tutor a message, today counts", async ({ page, llm }) => {
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ada" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();

  await expect(page.getByText("Start a new streak today")).toBeVisible();
  await expect(page.getByRole("img", { name: "Streak: 0 days" })).toBeVisible();
  const week = page.getByRole("list", { name: "The last seven days" });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.getByRole("listitem").last()).toContainText("today, not yet");

  await llm.replyWith("A ratio compares two quantities. What is the ratio of 4 cats to 5 dogs?");
  await page.getByRole("button", { name: "Continue with Jarvis" }).click();
  const transcript = page.getByRole("list", { name: "Conversation" });
  await expect(transcript).toContainText("4 cats to 5 dogs?");
  await llm.decideWith({ verdict: "continue" });
  await llm.replyWith("Nearly! Try again.");
  await page.getByLabel("Your answer").fill("5 to 4");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(transcript).toContainText("Nearly! Try again.");
  await page.getByRole("button", { name: "Leave" }).click();

  await expect(page.getByRole("img", { name: "Streak: 1 day" })).toBeVisible();
  await expect(page.getByText("Start a new streak today")).toHaveCount(0);
  await expect(week.getByRole("listitem").last()).toContainText("worked");
});
