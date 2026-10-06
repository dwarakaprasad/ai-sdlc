import { Hono } from "hono";
import { LlmError } from "../llm/provider";
import { DEFAULT_LLM_SETTINGS, isProviderId, providerInfo } from "../shared/llm";
import { DEFAULT_TEACHING_SETTINGS, MAX_RE_EXPLANATIONS_LIMIT, type ConnectionTest, type LlmSettings, type TeachingSettings } from "../shared/api";
import type { AppDeps } from "./deps";
import type { Db } from "./db";
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
export function teachingSettings(db: Db): TeachingSettings {
  const row = db.select().from(settings).get();
  return row ? { maxReExplanations: row.maxReExplanations } : { ...DEFAULT_TEACHING_SETTINGS };
}

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
      const { maxReExplanations } = (await readJsonObject(c)) ?? {};
      if (!Number.isInteger(maxReExplanations) || (maxReExplanations as number) < 0 || (maxReExplanations as number) > MAX_RE_EXPLANATIONS_LIMIT) {
        return c.json({ error: "invalidMaxReExplanations" }, 400);
      }
      saveSettings(db, { maxReExplanations: maxReExplanations as number });
      return c.json(teachingSettings(db));
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
