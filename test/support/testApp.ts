import { createApp } from "../../src/server/app";
import { openDatabase } from "../../src/server/db";
import { writeFixture } from "./curriculumFixture";

/**
 * The main test seam: the Hono app called in-process (no network listener)
 * against a fresh in-memory SQLite database and a Curriculum folder (empty unless given). Each client keeps its own cookies,
 * so two clients act like two browsers.
 */
export function createTestApp(options: { curriculaDir?: string } = {}) {
  const app = createApp({
    db: openDatabase(":memory:"),
    curriculaDir: options.curriculaDir ?? writeFixture({}),
  });

  function client() {
    let cookie = "";
    return async function request(path: string, body?: unknown) {
      const headers: Record<string, string> = {};
      if (cookie) headers.cookie = cookie;
      if (body !== undefined) headers["content-type"] = "application/json";
      const res = await app.request(path, {
        method: body === undefined ? "GET" : "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0] ?? "";
      return res;
    };
  }

  return { client };
}
