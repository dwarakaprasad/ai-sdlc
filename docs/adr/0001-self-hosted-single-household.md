# Self-hosted, one household per install, no cloud accounts

Each family forks the repo and runs the app on their own machine; one install serves one household (one Parent, several Learners). We rejected a hosted multi-family service because it would mean storing children's data and API keys centrally, plus sign-up, billing and privacy obligations we don't want for an open-source hobby project. "Login" means local profiles only: a Parent password and per-Learner profiles, stored in the local SQLite database.

## Consequences

- Shareable Curriculum lives in markdown files (forkable, committable); private data (Learners, Goals, progress, transcripts, the API key) lives in a git-ignored SQLite database and is never committed.
- Multi-tenant concerns (tenant isolation, account recovery, rate limiting across families) are explicitly out of scope.
