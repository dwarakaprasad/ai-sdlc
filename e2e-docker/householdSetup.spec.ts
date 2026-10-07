import { expect, test } from "@playwright/test";

/**
 * Against the app as `docker compose up` starts it, on a fresh ./data: whatever ./curricula holds, a Parent can set up a household.
 * It doesn't name a Curriculum, because every fork has its own, and never reaches the Tutor, so it needs no API key.
 */
test("a Parent sets a password and adds a Learner on the first Curriculum listed", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Welcome to Home Tutor" }), "the app should open on first-time setup; is ./data fresh?").toBeVisible();
  await page.getByLabel("Parent password").fill("correct horse");
  await page.getByLabel("Confirm password").fill("correct horse");
  await page.getByRole("button", { name: "Set password" }).click();

  // With no valid Curriculum, the app says so in place of the form.
  const addLearnerHeading = page.getByRole("heading", { name: "Add a Learner" });
  const noCurriculum = page.getByText("Add a valid Curriculum before adding Learners.");
  await expect(addLearnerHeading.or(noCurriculum)).toBeVisible();
  await expect(noCurriculum, "no Curriculum is listed: ./curricula needs at least one valid Curriculum").toBeHidden();
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("textbox", { name: "Grade" }).fill("6");
  await page.getByRole("combobox", { name: "Curriculum" }).selectOption({ index: 0 });
  await page.getByRole("button", { name: "Add Learner" }).click();

  await expect(page.getByRole("main").getByRole("heading", { name: "Ada" })).toBeVisible();
});
