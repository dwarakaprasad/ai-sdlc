import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { TokenUsage } from "../llm/provider";
import type { DailyUsage, LlmSettings } from "../shared/api";
import type { AppDeps } from "./deps";
import type { Db } from "./db";
import { llmUsage } from "./db/schema";
import { limitSettings } from "./settings";

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

/** Whether the tokens used so far on `at`'s day (in and out) have reached the Parent's daily cap; never while there's no cap. */
export function dailyLimitReached(db: Db, at: Date): boolean {
  const { dailyTokenCap } = limitSettings(db);
  if (dailyTokenCap === null) return false;
  const used = db
    .select({ tokens: sql<number>`coalesce(sum(${llmUsage.inputTokens} + ${llmUsage.outputTokens}), 0)` })
    .from(llmUsage)
    .where(eq(llmUsage.date, localDate(at)))
    .get()!.tokens;
  return used >= dailyTokenCap;
}

/** The Parent's view of token usage, mounted under the Parent's protected routes. */
export function parentUsageRoutes({ db }: AppDeps) {
  return new Hono().get("/", (c) => c.json(dailyUsage(db)));
}
