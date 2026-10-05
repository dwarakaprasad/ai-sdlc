## Parent

#1

## What to build

The LLM provider interface (ADR 0002), with an Anthropic adapter:
- **Interface:** two operations, a streamed chat turn and a structured-output call that returns JSON matching a schema. Both report token usage.
- **Anthropic adapter:** reads its key only from the environment variable.
- **Settings:** the Parent area lets the Parent choose provider and model, stored in SQLite, and offers a "test connection" action that reports a missing or rejected key clearly.
- **Usage:** every call's token usage is recorded per day.
- **Tests:** a scripted fake provider is plugged into the Seam 1 test setup, so later tickets can script Tutor replies and decisions.

## Acceptance criteria

- [ ] The provider interface supports streamed chat and structured output, and both report token usage.
- [ ] The Anthropic adapter uses only the environment-variable key. The key is never written to SQLite, markdown or logs.
- [ ] The Parent can select provider and model. "Test connection" shows a clear message for a missing key, a rejected key, and success.
- [ ] Token usage is recorded per call with its date.
- [ ] The scripted fake provider is available in API tests, and tests use it to cover settings and usage recording.

## Blocked by

- #14
