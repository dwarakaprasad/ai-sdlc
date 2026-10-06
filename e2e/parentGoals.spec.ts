import type { APIRequestContext } from "@playwright/test";
import { daysFromNow, expect, flagCurrentGoal, setUpHousehold, test } from "./fixtures";

/** Logs the Parent in over the API; the page shares its cookies, so it opens on the Parent area. */
async function logInParent(request: APIRequestContext) {
  expect((await request.post("/api/parent/login", { data: { password: "correct horse" } })).ok()).toBe(true);
}

/** Sets a Goal for the named Learner over the API, as the Parent. */
async function setGoal(request: APIRequestContext, name: string, lessonKey: string, targetDate: string) {
  const learners = (await (await request.get("/api/parent/learners")).json()) as { id: number; name: string }[];
  const id = learners.find((l) => l.name === name)!.id;
  expect((await request.post(`/api/parent/learners/${id}/goals`, { data: { lessonKey, targetDate } })).ok()).toBe(true);
}

test("the Parent sees which Goals need attention, filters to them, and reviews a Flagged Goal", async ({ page, llm }) => {
  // Ada's first Goal, Understanding ratios, is Flagged; Equivalent ratios is 3 days overdue; Dividing fractions is on time.
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await flagCurrentGoal(page.request, llm, "Ada");
  await logInParent(page.request);
  await setGoal(page.request, "Ada", "math/term-1/unit-1/lesson-2", daysFromNow(-3));
  await setGoal(page.request, "Ada", "math/term-1/unit-2/lesson-1", daysFromNow(40));

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Ada.*2 Goals need attention/ })).toBeVisible();
  const table = page.getByRole("table");
  const row = (title: string) => table.getByRole("row").filter({ hasText: title });
  await expect(row("Understanding ratios")).toContainText("Flagged");
  await expect(row("Understanding ratios").getByRole("button", { name: "Review" })).toBeVisible();
  await expect(row("Equivalent ratios")).toContainText("3 days overdue");
  await expect(row("Equivalent ratios").getByRole("button", { name: "Change" })).toBeVisible();
  await expect(row("Dividing fractions")).not.toContainText("overdue");

  // Needs attention leaves only the overdue and Flagged Goals.
  await page.getByRole("button", { name: "Needs attention · 2" }).click();
  await expect(row("Understanding ratios")).toBeVisible();
  await expect(row("Equivalent ratios")).toBeVisible();
  await expect(row("Dividing fractions")).toHaveCount(0);

  // Reviewing the Flagged Goal and retrying it resolves it, so it needs nothing more.
  await row("Understanding ratios").getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("button", { name: "Needs attention · 1" })).toBeVisible();
  await expect(row("Understanding ratios")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ada.*1 Goal needs attention/ })).toBeVisible();

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(row("Understanding ratios")).toContainText("Active");
});

test("the Parent reads a Session transcript from the progress view", async ({ page, llm }) => {
  await setUpHousehold(page.request, [{ name: "Ada" }]);
  await flagCurrentGoal(page.request, llm, "Ada");
  await logInParent(page.request);

  await page.goto("/");
  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByLabel("Goals at a glance")).toContainText("Flagged1");
  await page.getByRole("button", { name: "Read transcript" }).click();

  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(transcript.getByRole("heading", { name: "Understanding ratios" })).toBeVisible();
  await expect(transcript).toContainText("A ratio compares two quantities.");
  await expect(transcript).toContainText("I don't get it");
  await transcript.getByRole("button", { name: "Close transcript" }).click();
  await expect(page.getByRole("button", { name: "Read transcript" })).toBeVisible();
});
