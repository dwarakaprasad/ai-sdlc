import { Hono } from "hono";
import { LlmError } from "../llm/provider";
import { DEFAULT_LLM_SETTINGS, isProviderId, providerInfo } from "../shared/llm";
import {
  DEFAULT_LIMIT_SETTINGS,
  DEFAULT_TEACHING_SETTINGS,
  MAX_BREAK_MINUTES,
  MAX_QUIZ_ATTEMPTS_LIMIT,
  MAX_RE_EXPLANATIONS_LIMIT,
  type ConnectionTest,
  type LimitSettings,
  type LlmSettings,
  type TeachingSettings,
} from "../shared/api";
import type { AppDeps } from "./deps";
import type { Db, DbReader } from "./db";
import { settings } from "./db/schema";
import { readJsonObject } from "./http";
import { appLlm } from "./llm";

/** The provider and model the Tutor uses: the Parent's choice, or the default until they make one. */
export function llmSettings(db: Db): LlmSettings {
  const row = db.select().from(settings).get();
  // A provider removed from the app since it was saved falls back to the default.
  if (!row || !isProviderId(row.llmProvider)) return { ...DEFAULT_LLM_SETTINGS };
  return { provider: row.llmProvider, model: row.llmModel };
}

/** How the Tutor teaches: the Parent's choices, or the defaults until they make them. */
export function teachingSettings(db: DbReader): TeachingSettings {
  const row = db.select().from(settings).get();
  if (!row) return { ...DEFAULT_TEACHING_SETTINGS };
  const { maxReExplanations, passMark, maxQuizAttempts } = row;
  return { maxReExplanations, passMark, maxQuizAttempts };
}

/** The daily token cap and break prompt: the Parent's choices, or the defaults until they make them. */
export function limitSettings(db: DbReader): LimitSettings {
  const row = db.select().from(settings).get();
  if (!row) return { ...DEFAULT_LIMIT_SETTINGS };
  const { dailyTokenCap, breakMinutes } = row;
  return { dailyTokenCap, breakMinutes };
}

/** Whether `value` is a whole number from `min` to `max`. */
const isWholeIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Each teaching setting's allowed whole-number range, and the error a value outside it gets. */
const TEACHING_RANGES: { [K in keyof TeachingSettings]: { min: number; max: number; error: string } } = {
  maxReExplanations: { min: 0, max: MAX_RE_EXPLANATIONS_LIMIT, error: "invalidMaxReExplanations" },
  passMark: { min: 1, max: 100, error: "invalidPassMark" },
  maxQuizAttempts: { min: 1, max: MAX_QUIZ_ATTEMPTS_LIMIT, error: "invalidMaxQuizAttempts" },
};

/** Saves some of the Parent's settings; the first save fills the rest with their defaults. */
function saveSettings(db: Db, values: Partial<typeof settings.$inferInsert>) {
  db.insert(settings)
    .values({ id: 1, llmProvider: DEFAULT_LLM_SETTINGS.provider, llmModel: DEFAULT_LLM_SETTINGS.model, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values })
    .run();
}

/** The Parent's settings, mounted under the Parent's protected routes. */
export function parentSettingsRoutes(deps: AppDeps) {
  const { db } = deps;
  return new Hono()
    .get("/teaching", (c) => c.json(teachingSettings(db)))
    .put("/teaching", async (c) => {
      // Only the settings sent change, and nothing is saved unless every one sent is valid.
      const body = (await readJsonObject(c)) ?? {};
      const changes: Partial<TeachingSettings> = {};
      for (const name of Object.keys(TEACHING_RANGES) as (keyof TeachingSettings)[]) {
        if (!(name in body)) continue;
        const value = body[name];
        const { min, max, error } = TEACHING_RANGES[name];
        if (!isWholeIn(value, min, max)) return c.json({ error }, 400);
        changes[name] = value;
      }
      if (Object.keys(changes).length > 0) saveSettings(db, changes);
      return c.json(teachingSettings(db));
    })
    .get("/limits", (c) => c.json(limitSettings(db)))
    .put("/limits", async (c) => {
      // Like the teaching settings: only those sent change, and nothing is saved unless every one sent is valid.
      const body = (await readJsonObject(c)) ?? {};
      const changes: Partial<LimitSettings> = {};
      if ("dailyTokenCap" in body) {
        const cap = body.dailyTokenCap;
        if (cap !== null && !isWholeIn(cap, 1, Number.MAX_SAFE_INTEGER)) return c.json({ error: "invalidDailyTokenCap" }, 400);
        changes.dailyTokenCap = cap;
      }
      if ("breakMinutes" in body) {
        if (!isWholeIn(body.breakMinutes, 1, MAX_BREAK_MINUTES)) return c.json({ error: "invalidBreakMinutes" }, 400);
        changes.breakMinutes = body.breakMinutes;
      }
      if (Object.keys(changes).length > 0) saveSettings(db, changes);
      return c.json(limitSettings(db));
    })
    .get("/llm", (c) => c.json(llmSettings(db)))
    .put("/llm", async (c) => {
      const { provider, model } = (await readJsonObject(c)) ?? {};
      if (!isProviderId(provider)) return c.json({ error: "unknownProvider" }, 400);
      if (typeof model !== "string" || model.trim() === "") return c.json({ error: "modelRequired" }, 400);
      saveSettings(db, { llmProvider: provider, llmModel: model.trim() });
      return c.json(llmSettings(db));
    })
    .post("/llm/test", async (c) => {
      const { provider, model } = llmSettings(db);
      try {
        for await (const _ of appLlm(deps).chat({ system: "", messages: [{ role: "user", content: "Reply with OK." }] }));
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        const result: ConnectionTest = { ok: false, error: error.kind, envVar: providerInfo(provider).envVar, model };
        return c.json(result);
      }
      const result: ConnectionTest = { ok: true };
      return c.json(result);
    });
}
