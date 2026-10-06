import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

/** The built client, relative to the working directory as serveStatic wants it. */
const clientDir = relative(process.cwd(), fileURLToPath(new URL("../../dist/client", import.meta.url)));

/** Serves `app` on `port` with the built client alongside it; shared by the app's entry point and the end-to-end one. */
export function serveWithClient(app: Hono, port: number) {
  app.use("*", serveStatic({ root: clientDir }));
  // Unknown non-API paths fall back to the single-page app.
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    return serveStatic({ root: clientDir, path: "index.html" })(c, next);
  });

  return serve({ fetch: app.fetch, port }, ({ port }) => {
    console.log(`Home Tutor is running at http://localhost:${port}`);
  });
}
