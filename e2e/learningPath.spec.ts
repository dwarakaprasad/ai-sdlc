import type { Page } from "@playwright/test";
import { expect, setUpHousehold, test } from "./fixtures";

/** Logs Ada in and opens Math's Learning Path from its name on Today. */
async function openMathPath(page: Page) {
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ada" }).click();
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Math", level: 1 })).toBeVisible();
}

/** How many animations are running on the current Lesson's row: its pulse. */
const pulsing = (page: Page) =>
  page
    .locator('[aria-current="step"]')
    .evaluate((row) => row.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);

test("a Learner opens a Subject's Learning Path from Today, and only the current Lesson can be started", async ({ page, llm }) => {
  await openMathPath(page);

  await expect(page.getByText("Term 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("meter", { name: "0 of 5 done this Term" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ratios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fractions" })).toBeVisible();
  // One Start on the whole Path: the current Lesson's. Everything else is later.
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(1);
  const current = page.getByRole("listitem").filter({ hasText: "Understanding ratios" });
  await expect(current).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("listitem").filter({ hasText: "Equivalent ratios" })).toContainText("Later");

  await llm.replyWith("A ratio compares two quantities. What is the ratio of 4 cats to 5 dogs?");
  await current.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("list", { name: "Conversation" })).toContainText("4 cats to 5 dogs?");

  // Leaving the Session goes back to the Path; from Today, the top bar's Learning Path opens it again.
  await page.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByRole("heading", { name: "Math", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Today" }).first().click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();
  await page.getByRole("button", { name: "Learning Path" }).click();
  await expect(page.getByRole("heading", { name: "Math", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Learning Path" })).toHaveAttribute("aria-current", "page");
});

test("the current Lesson pulses, and stops when the device asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openMathPath(page);
  await expect.poll(() => pulsing(page)).toBe(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => pulsing(page)).toBe(0);
});
