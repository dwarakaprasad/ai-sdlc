import { expect, test } from "./fixtures";

test("a Parent sets a password, logs back in, and sees the Curricula, the settings and usage, each saving and validating", async ({ page, llm }) => {
  await page.goto("/");

  // First-time setup checks the two passwords match.
  await expect(page.getByRole("heading", { name: "Welcome to Home Tutor" })).toBeVisible();
  await page.getByLabel("Parent password").fill("correct horse");
  await page.getByLabel("Confirm password").fill("correct hose");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("alert")).toHaveText("The passwords don't match.");
  await page.getByLabel("Confirm password").fill("correct horse");
  await page.getByRole("button", { name: "Set password" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  // Login turns away a wrong password; Back returns to the profiles.
  await page.getByRole("button", { name: "Parent area" }).click();
  await expect(page.getByRole("heading", { name: "Parent login" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Who's learning today?" })).toBeVisible();
  await page.getByRole("button", { name: "Parent area" }).click();
  await page.getByLabel("Parent password").fill("wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("That password isn't right.");
  await page.getByLabel("Parent password").fill("correct horse");
  await page.getByRole("button", { name: "Log in" }).click();

  // The Curricula: the fixture one, with its Subjects.
  await page.getByRole("button", { name: "Curricula" }).click();
  const curriculum = page.getByRole("article").filter({ hasText: "grade-6" });
  await expect(curriculum.getByRole("heading")).toBeVisible();
  await expect(curriculum.getByRole("listitem").first()).toContainText("Lesson");

  // Settings: the Tutor model saves and its connection tests; teaching and limits validate, then save.
  await page.getByRole("button", { name: "Settings" }).click();
  const model = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Tutor model" }) });
  await expect(model.getByRole("button", { name: "Save" })).toBeDisabled();
  await model.getByLabel("Model").fill("another-model");
  await model.getByRole("button", { name: "Save" }).click();
  await expect(model.getByRole("status")).toHaveText("Saved.");
  await llm.replyWith("OK");
  await model.getByRole("button", { name: "Test connection" }).click();
  await expect(model.getByRole("status")).toHaveText("Connected. The Tutor is ready.");

  const teaching = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Teaching" }) });
  // Out of range, the browser holds the form back before it's sent.
  const passMark = teaching.getByLabel("Pass mark (%)");
  await passMark.fill("0");
  await teaching.getByRole("button", { name: "Save" }).click();
  expect(await passMark.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  await expect(teaching.getByRole("status")).toHaveCount(0);
  await passMark.fill("80");
  await teaching.getByRole("button", { name: "Save" }).click();
  await expect(teaching.getByRole("status")).toHaveText("Saved.");

  const limits = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Limits" }) });
  await limits.getByLabel("Daily token cap").fill("50000");
  await limits.getByRole("button", { name: "Save" }).click();
  await expect(limits.getByRole("status")).toHaveText("Saved.");

  // Saved settings are there after leaving and coming back.
  await page.getByRole("button", { name: "Usage" }).click();
  await expect(page.getByRole("heading", { name: "Token usage" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Pass mark (%)")).toHaveValue("80");
  await expect(page.getByLabel("Daily token cap")).toHaveValue("50000");
  await expect(page.getByLabel("Model")).toHaveValue("another-model");
});
