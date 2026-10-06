import type { LlmProvider } from "../llm/provider";
import type { ProviderId } from "../shared/llm";
import type { Db } from "./db";

/** What the app needs from the outside world; tests pass in-memory or fake versions. */
export type AppDeps = {
  db: Db;
  /** Folder holding one sub-folder per Curriculum; read-only input. */
  curriculaDir: string;
  /** One adapter per provider; the Parent's settings pick which one is used. */
  providers: Record<ProviderId, LlmProvider>;
  /** The clock, so usage dates are testable. */
  now: () => Date;
};
