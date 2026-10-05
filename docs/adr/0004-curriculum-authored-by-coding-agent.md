# Curriculum is authored by the Parent's coding agent, not in the app

The app has no Curriculum editor. Parents draft and edit Curriculum markdown with their own coding agent (Claude Code, Codex, Cursor, …) guided by the repo-shipped Curriculum Assistant instructions, or by hand; the app only reads and validates the files. This keeps v1's web app lean, puts drafting where the tooling is strongest (web search, interviewing, file editing), and lets Parents use their own agent subscription without the app ever touching it (see ADR 0002).

## Consequences

- The Curriculum markdown format is a public contract: the app's parser, the `curriculum:check` validator, and the Curriculum Assistant instructions must change together.
- The Curriculum Assistant instructions are agent-agnostic markdown referenced from `AGENTS.md`, with thin vendor-specific wrappers (e.g. a Claude Code skill); a draft isn't done until `curriculum:check` passes.
