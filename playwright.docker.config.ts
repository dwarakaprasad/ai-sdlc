import { defineConfig, devices } from "@playwright/test";

/**
 * The Docker suite: Playwright drives the app already started by `docker compose up`, on HOME_TUTOR_PORT as the README says.
 * It shares nothing with the end-to-end suite (playwright.config.ts): no managed server, no fake LLM, no reset, no fixture Curriculum.
 */
export default defineConfig({
  testDir: "e2e-docker",
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${process.env.HOME_TUTOR_PORT || 3000}`,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  projects: [{ name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
