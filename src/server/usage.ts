import { desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { TokenUsage } from "../llm/provider";
import type { DailyUsage, LlmSettings } from "../shared/api";
import type { AppDeps } from "./deps";
import type { Db } from "./db";
import { llmUsage } from "./db/schema";

/** `at` as the server's local calendar day, YYYY-MM-DD. */
export function localDate(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Records one call's tokens against the provider and model it ran on. */
export function recordUsage(db: Db, at: Date, { provider, model }: LlmSettings, usage: TokenUsage) {
  db.insert(llmUsage)
    .values({ date: localDate(at), provider, model, ...usage, createdAt: at })
    .run();
}

/** Token totals per day, most recent first. */
export function dailyUsage(db: Db): DailyUsage[] {
  return db
    .select({
      date: llmUsage.date,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`sum(${llmUsage.inputTokens})`,
      outputTokens: sql<number>`sum(${llmUsage.outputTokens})`,
    })
    .from(llmUsage)
    .groupBy(llmUsage.date)
    .orderBy(desc(llmUsage.date))
    .all();
}

/** The Parent's view of token usage, mounted under the Parent's protected routes. */
export function parentUsageRoutes({ db }: AppDeps) {
  return new Hono().get("/", (c) => c.json(dailyUsage(db)));
}
