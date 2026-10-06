import { describe, expect, it } from "vitest";
import { createTestApp } from "./support/testApp";

async function setUp(options: Parameters<typeof createTestApp>[0] = {}) {
  const testApp = createTestApp(options);
  const parent = testApp.client();
  await parent("/api/parent/setup", { password: "correct horse" });
  return { ...testApp, parent };
}

describe("LLM settings in the Parent area", () => {
  it("starts on Anthropic with the default model", async () => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/settings/llm");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ provider: "anthropic", model: "claude-opus-5-5" });
  });

  it("lets the Parent choose the provider and model", async () => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/settings/llm", { provider: "anthropic", model: " claude-haiku-4-5 " }, "PUT");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
    expect(await (await parent("/api/parent/settings/llm")).json()).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
  });

  it.each([
    [{ provider: "acme", model: "x" }, "unknownProvider"],
    [{ provider: "anthropic", model: "  " }, "modelRequired"],
  ])("refuses %j", async (body, error) => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/settings/llm", body, "PUT");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await (await parent("/api/parent/settings/llm")).json()).toEqual({ provider: "anthropic", model: "claude-opus-5-5" });
  });

  it("needs a Parent login", async () => {
    const { client } = await setUp();

    const res = await client()("/api/parent/settings/llm");

    expect(res.status).toBe(401);
  });
});
