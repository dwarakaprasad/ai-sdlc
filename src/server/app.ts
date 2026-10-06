import { Hono } from "hono";
import type { AppDeps } from "./deps";
import { learnerRoutes } from "./learnerLogin";
import { parentRoutes } from "./parent";

export function createApp(deps: AppDeps) {
  return new Hono().route("/api/parent", parentRoutes(deps)).route("/api/learner", learnerRoutes(deps));
}
