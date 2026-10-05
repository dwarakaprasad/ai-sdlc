import { Hono } from "hono";
import type { AppDeps } from "./deps";
import { parentRoutes } from "./parent";

export function createApp(deps: AppDeps) {
  return new Hono().route("/api/parent", parentRoutes(deps));
}
