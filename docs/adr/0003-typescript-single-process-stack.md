# TypeScript end to end, single process, SQLite

The app is one Node process: a Vite + React front end served by a Hono API server, with SQLite via Drizzle, started with `npm start` or Docker Compose. Most of the work is UI (streaming chat, quizzes, math rendering, the Parent's Curriculum setup wizard) while the LLM side is a handful of provider SDK calls, so one TypeScript codebase with types shared between UI and server beats splitting the stack.

## Considered Options

- **FastAPI (Python) + React**: the closest alternative; two toolchains and duplicated API types for little gain. Worth revisiting if a content pipeline (e.g. video transcripts, deferred from v1) grows into the core of the product.
- **Python server-rendered (Django/FastAPI + HTMX)**: awkward for live chat and quiz UI.
- **Streamlit / Gradio / Chainlit**: fine for a prototype, but can't comfortably carry two roles, a setup wizard and custom quiz screens.
- **Next.js**: brings server-rendering concepts this local single-household app doesn't need.
