import { describe, expect, it } from "vitest";
import { createTestApp } from "./support/testApp";

describe("Token usage", () => {
  it("records every call's tokens against the day it was made", async () => {
    let now = new Date(2026, 9, 5, 23, 30);
    const { client, llm } = createTestApp({ now: () => now });
    const parent = client();
    await parent("/api/parent/setup", { password: "correct horse" });
    llm.replyWith("OK", { inputTokens: 100, outputTokens: 7 });
    llm.replyWith("OK", { inputTokens: 50, outputTokens: 3 });
    llm.replyWith("OK", { inputTokens: 20, outputTokens: 1 });

    await parent("/api/parent/settings/llm/test", {});
    await parent("/api/parent/settings/llm/test", {});
    now = new Date(2026, 9, 6, 0, 15);
    await parent("/api/parent/settings/llm/test", {});

    const res = await parent("/api/parent/usage");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { date: "2026-10-06", calls: 1, inputTokens: 20, outputTokens: 1 },
      { date: "2026-10-05", calls: 2, inputTokens: 150, outputTokens: 10 },
    ]);
  });

  it("records the tokens of a call that failed after the provider billed it, such as a refusal", async () => {
    const { client, llm } = createTestApp({ now: () => new Date(2026, 9, 5, 12) });
    const parent = client();
    await parent("/api/parent/setup", { password: "correct horse" });
    llm.failChatWith("failed", { inputTokens: 30, outputTokens: 4 });

    await parent("/api/parent/settings/llm/test", {});

    expect(await (await parent("/api/parent/usage")).json()).toEqual([
      { date: "2026-10-05", calls: 1, inputTokens: 30, outputTokens: 4 },
    ]);
  });

  it("records nothing for a call the provider turned away", async () => {
    const { client, llm } = createTestApp();
    const parent = client();
    await parent("/api/parent/setup", { password: "correct horse" });
    llm.failChatWith("rejectedKey");

    await parent("/api/parent/settings/llm/test", {});

    expect(await (await parent("/api/parent/usage")).json()).toEqual([]);
  });
});
