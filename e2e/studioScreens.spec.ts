import type { Page } from "@playwright/test";
import { expect, setUpHousehold, test } from "./fixtures";

/** Opens the app on the profile picker of a household with Ada (no PIN) and Ben (PIN 1234), each with one Goal. */
async function openProfiles(page: Page) {
  await setUpHousehold(page.request, [{ name: "Ada" }, { name: "Ben", pin: "1234" }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who's learning today?" })).toBeVisible();
}

async function logInAsAda(page: Page) {
  await page.getByRole("button", { name: "Ada" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();
}

/** Every visible control too small to tap: under 44px either way. */
const smallControls = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a, input, select, textarea")]
      .filter((el) => el.checkVisibility())
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.tagName} "${el.textContent?.trim() || el.getAttribute("aria-label")}" ${box.width}×${box.height}`),
  );

const runningAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);

test("a Learner sees which profiles have a PIN, opens Today with their Goal, and switches profile from the top bar", async ({ page }) => {
  await openProfiles(page);
  await expect(page.getByRole("button", { name: "Ben" })).toContainText("PIN");
  await expect(page.getByRole("button", { name: "Ada" })).not.toContainText("PIN");

  await logInAsAda(page);
  await expect(page.getByRole("button", { name: "Today" })).toHaveAttribute("aria-current", "page");
  const goal = page.getByRole("article").filter({ hasText: "Understanding ratios" });
  await expect(goal).toContainText("Math");
  await expect(goal.getByRole("button", { name: "Continue with Jarvis" })).toBeVisible();

  await page.getByRole("button", { name: "Switch profile" }).click();
  await expect(page.getByRole("heading", { name: "Who's learning today?" })).toBeVisible();
});

test("Nunito comes from the app itself; no request goes to a font CDN or anywhere else", async ({ page, baseURL }) => {
  const elsewhere: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) elsewhere.push(request.url());
  });
  await openProfiles(page);
  await logInAsAda(page);

  const nunitoLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((face) => face.family.includes("Nunito") && face.status === "loaded");
  });
  expect(nunitoLoaded).toBe(true);
  expect(elsewhere).toEqual([]);
});

test("every control on the profile picker, the PIN screen and Today is at least 44px", async ({ page }) => {
  await openProfiles(page);
  expect(await smallControls(page)).toEqual([]);

  await page.getByRole("button", { name: "Ben" }).click();
  await expect(page.getByLabel("PIN")).toBeVisible();
  expect(await smallControls(page)).toEqual([]);
  await page.getByRole("button", { name: "Back" }).click();

  await logInAsAda(page);
  expect(await smallControls(page)).toEqual([]);
});

test("the Tutor mark moves, and every animation stops when the device asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openProfiles(page);
  await expect.poll(() => runningAnimations(page)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => runningAnimations(page)).toBe(0);
  await logInAsAda(page);
  await expect.poll(() => runningAnimations(page)).toBe(0);
});

test("on a phone, the profile picker and Today fit the screen in one column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await openProfiles(page);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await logInAsAda(page);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Continue with Jarvis" })).toBeInViewport();
});
