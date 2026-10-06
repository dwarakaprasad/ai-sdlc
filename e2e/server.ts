import { Hono } from "hono";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server/app";
import { openDatabase } from "../src/server/db";
import { serveWithClient } from "../src/server/serve";
import { inFolder, validCurriculum, writeFixture } from "../test/support/curriculumFixture";
import { createFakeLlm } from "../test/support/fakeLlm";
import { fakeForEveryProvider } from "../test/support/testApp";

/**
 * The server in end-to-end mode, for Playwright (playwright.config.ts): the real app and the built client, composed with
 * a temporary database, a fixture Curriculum ("grade-6") and the scripted fake LLM standing in for every provider,
 * so no API key is needed. Tests script the fake and reset the install over the /__e2e routes, which exist only here.
 */

// playwright.config.ts picks the port.
const port = Number(process.env.PORT);
if (!port) throw new Error("Set PORT to run the server in end-to-end mode.");
const curriculaDir = writeFixture(inFolder("grade-6", validCurriculum));

/** A fresh install: an empty database and a fake LLM with nothing scripted. `close` deletes the database. */
function freshInstall() {
  const dataDir = mkdtempSync(join(tmpdir(), "home-tutor-e2e-"));
  const llm = createFakeLlm();
  const db = openDatabase(join(dataDir, "home-tutor.db"));
  const app = createApp({ db, curriculaDir, providers: fakeForEveryProvider(llm), now: () => new Date() });
  const close = () => {
    db.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  };
  return { app, llm, close };
}

let install = freshInstall();

const app = new Hono()
  .get("/__e2e/health", (c) => c.text("ok"))
  .post("/__e2e/reset", (c) => {
    install.close();
    install = freshInstall();
    return c.body(null, 204);
  })
  .post("/__e2e/llm/reply", async (c) => {
    const { reply, pieceDelayMs } = await c.req.json<{ reply: string; pieceDelayMs?: number }>();
    install.llm.replyWith(reply, undefined, { pieceDelayMs });
    return c.body(null, 204);
  })
  .post("/__e2e/llm/decide", async (c) => {
    install.llm.decideWith((await c.req.json<{ data: unknown }>()).data);
    return c.body(null, 204);
  })
  // Looked up per request, so a reset swaps the whole app.
  .all("/api/*", (c) => install.app.fetch(c.req.raw, c.env));

serveWithClient(app, port);

process.on("exit", () => {
  install.close();
  rmSync(curriculaDir, { recursive: true, force: true });
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => process.exit(0));
