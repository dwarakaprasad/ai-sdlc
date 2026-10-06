import { describe, expect, it } from "vitest";
import { anthropicProvider } from "../src/llm/anthropic";
import { openaiProvider } from "../src/llm/openai";
import { createTestApp } from "./support/testApp";

async function setUp(options: Parameters<typeof createTestApp>[0] = {}) {
  const testApp = createTestApp(options);
  const parent = testApp.client();
  await parent("/api/parent/setup", { password: "correct horse" });
  return { ...testApp, parent };
}

const testConnection = "/api/parent/settings/llm/test";

describe("Testing the LLM connection", () => {
  it("reports success when the provider answers, using the chosen model", async () => {
    const { parent, llm } = await setUp();
    await parent("/api/parent/settings/llm", { provider: "anthropic", model: "claude-haiku-4-5" }, "PUT");
    llm.replyWith("OK");

    const res = await parent(testConnection, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(llm.requests).toMatchObject([{ kind: "chat", model: "claude-haiku-4-5" }]);
  });

  it.each(["missingKey", "rejectedKey", "unknownModel", "failed"] as const)("reports %s, naming the environment variable", async (kind) => {
    const { parent, llm } = await setUp();
    llm.failChatWith(kind);

    const res = await parent(testConnection, {});

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: kind, envVar: "ANTHROPIC_API_KEY", model: "claude-opus-5-5" });
  });

  it("reports a missing key from the real Anthropic adapter without calling out", async () => {
    const { parent } = await setUp({ providers: { anthropic: anthropicProvider({ ANTHROPIC_API_KEY: "  " }) } });

    const res = await parent(testConnection, {});

    expect(await res.json()).toEqual({ ok: false, error: "missingKey", envVar: "ANTHROPIC_API_KEY", model: "claude-opus-5-5" });
  });

  it("uses the OpenAI provider when the Parent chooses it", async () => {
    const { parent, llm } = await setUp({ providers: { anthropic: anthropicProvider({}) } });
    await parent("/api/parent/settings/llm", { provider: "openai", model: "gpt-5.4-mini" }, "PUT");
    llm.replyWith("OK");

    const res = await parent(testConnection, {});

    expect(await res.json()).toEqual({ ok: true });
    expect(llm.requests).toMatchObject([{ kind: "chat", model: "gpt-5.4-mini" }]);
  });

  it.each(["missingKey", "rejectedKey"] as const)("reports %s for OpenAI, naming its environment variable", async (kind) => {
    const { parent, llm } = await setUp();
    await parent("/api/parent/settings/llm", { provider: "openai", model: "gpt-5.4" }, "PUT");
    llm.failChatWith(kind);

    const res = await parent(testConnection, {});

    expect(await res.json()).toEqual({ ok: false, error: kind, envVar: "OPENAI_API_KEY", model: "gpt-5.4" });
  });

  it("reports a missing key from the real OpenAI adapter without calling out", async () => {
    const { parent } = await setUp({ providers: { openai: openaiProvider({ OPENAI_API_KEY: "" }) } });
    await parent("/api/parent/settings/llm", { provider: "openai", model: "gpt-5.4" }, "PUT");

    const res = await parent(testConnection, {});

    expect(await res.json()).toEqual({ ok: false, error: "missingKey", envVar: "OPENAI_API_KEY", model: "gpt-5.4" });
  });
});
