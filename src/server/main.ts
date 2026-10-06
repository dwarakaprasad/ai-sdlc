import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { curriculaDir } from "../curriculum";
import { anthropicProvider } from "../llm/anthropic";
import { openaiProvider } from "../llm/openai";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { serveWithClient } from "./serve";

// API keys come from the environment, optionally via a git-ignored .env (ADR 0002). Variables already set win.
if (existsSync(".env")) process.loadEnvFile(".env");

// Private family data lives here; the folder is git-ignored (ADR 0001).
const dataDir = process.env.HOME_TUTOR_DATA_DIR ?? "data";
const port = Number(process.env.PORT ?? 3000);

mkdirSync(dataDir, { recursive: true });
const app = createApp({
  db: openDatabase(join(dataDir, "home-tutor.db")),
  curriculaDir: curriculaDir(),
  providers: { anthropic: anthropicProvider(), openai: openaiProvider() },
  now: () => new Date(),
});

serveWithClient(app, port);
