import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { curriculaDir } from "../curriculum";
import { createApp } from "./app";
import { openDatabase } from "./db";

// Private family data lives here; the folder is git-ignored (ADR 0001).
const dataDir = process.env.HOME_TUTOR_DATA_DIR ?? "data";
const port = Number(process.env.PORT ?? 3000);
const clientDir = relative(process.cwd(), fileURLToPath(new URL("../../dist/client", import.meta.url)));

mkdirSync(dataDir, { recursive: true });
const app = createApp({ db: openDatabase(join(dataDir, "home-tutor.db")), curriculaDir: curriculaDir() });

app.use("*", serveStatic({ root: clientDir }));
// Unknown non-API paths fall back to the single-page app.
app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api/")) return next();
  return serveStatic({ root: clientDir, path: "index.html" })(c, next);
});

serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`Home Tutor is running at http://localhost:${port}`);
});
