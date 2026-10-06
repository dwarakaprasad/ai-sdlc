import { createApp } from "../../src/server/app";
import type { AppDeps } from "../../src/server/deps";
import { openDatabase } from "../../src/server/db";
import { PROVIDERS } from "../../src/shared/llm";
import { writeFixture } from "./curriculumFixture";
import { createFakeLlm, type FakeLlm } from "./fakeLlm";

/**
 * The main test seam: the Hono app called in-process (no network listener)
 * against a fresh in-memory SQLite database, a Curriculum folder (empty unless given) and a scripted fake LLM
 * standing in for every provider (unless `providers` says otherwise). Each client keeps its own cookies,
 * so two clients act like two browsers. `now` fixes the clock.
 */
export function createTestApp(
  options: { curriculaDir?: string; providers?: Partial<AppDeps["providers"]>; now?: () => Date } = {},
) {
  const llm: FakeLlm = createFakeLlm();
  const app = createApp({
    db: openDatabase(":memory:"),
    curriculaDir: options.curriculaDir ?? writeFixture({}),
    providers: { ...fakeForEveryProvider(llm), ...options.providers },
    now: options.now ?? (() => new Date()),
  });

  function client() {
    let cookie = "";
    /** GET without a body, POST with one, unless `method` says otherwise. */
    return async function request(path: string, body?: unknown, method?: "PUT" | "PATCH" | "DELETE") {
      const headers: Record<string, string> = {};
      if (cookie) headers.cookie = cookie;
      if (body !== undefined) headers["content-type"] = "application/json";
      const res = await app.request(path, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0] ?? "";
      return res;
    };
  }

  return { client, llm };
}

/** The fake standing in for every provider, so the Parent's choice of provider makes no difference. */
export function fakeForEveryProvider(llm: FakeLlm) {
  return Object.fromEntries(PROVIDERS.map((p) => [p.id, llm.provider])) as AppDeps["providers"];
}
