import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROVIDERS } from "../src/shared/llm";

describe("The .env example", () => {
  it.each(PROVIDERS.map((p) => [p.name, p.envVar]))("documents the %s key variable, %s", (_name, envVar) => {
    const example = readFileSync(".env.example", "utf8");

    expect(example).toMatch(new RegExp(`^#?\\s*${envVar}=`, "m"));
  });

  it("is committed, while the real .env is git-ignored", () => {
    const ignored = (path: string) => spawnSync("git", ["check-ignore", "-q", path]).status === 0;

    expect(ignored(".env")).toBe(true);
    expect(ignored(".env.example")).toBe(false);
  });
});
