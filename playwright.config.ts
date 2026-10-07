import { defineConfig, devices } from "@playwright/test";

const port = 3100;

/**
 * The browser seam: Playwright drives the built client served by the real server in end-to-end mode (e2e/server.ts).
 * `npm run test:e2e` builds the client first. Every test shares one server and resets it, so tests run one at a time.
 */
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // Animations off, so they can't make tests flaky.
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  projects: [
    // The browser an iPad-using Learner actually has: Safari's engine, touch, and a landscape tablet viewport.
    { name: "tablet", use: { ...devices["iPad (gen 7) landscape"] } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "tsx e2e/server.ts",
    url: `http://localhost:${port}/__e2e/health`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
    // SIGTERM (not the default SIGKILL) lets the server delete its temporary folders.
    gracefulShutdown: { signal: "SIGTERM", timeout: 2000 },
  },
});
