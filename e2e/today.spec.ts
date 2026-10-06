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
