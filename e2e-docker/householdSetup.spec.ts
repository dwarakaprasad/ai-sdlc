import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import type { LearnerProfile } from "../src/shared/api";

/**
 * Against the app as `docker compose up` starts it, on a fresh ./data: whatever ./curricula holds, a Parent can set up a household,
 * and it is still there once the container is replaced. It doesn't name a Curriculum, because every fork has its own,
 * and never reaches the Tutor, so it needs no API key.
 */
// The suite has no reset, so the second test checks the household the first set up, and is skipped if that failed.
test.describe.configure({ mode: "serial" });

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

// A new container, not `docker compose restart`: a restarted container keeps its own files, so only a new one proves the data lives in ./data.
test("the Learner is still there after the container is recreated", async ({ request }) => {
  test.setTimeout(120_000);
  execFileSync("docker", ["compose", "up", "-d", "--force-recreate", "--wait"], { stdio: "inherit", timeout: 110_000 });

  const response = await request.get("/api/learner/profiles");
  expect(response.ok()).toBe(true);
  const names = ((await response.json()) as LearnerProfile[]).map((learner) => learner.name);
  expect(names, "household data didn't survive a new container: is ./data mounted?").toEqual(["Ada"]);
});
