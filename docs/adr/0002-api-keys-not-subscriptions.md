# Connect to LLMs with API keys, not consumer subscriptions

The original ask was to reuse a parent's Claude or ChatGPT subscription. Consumer subscriptions don't grant API access to third-party apps (ChatGPT Plus has no API access; Anthropic's terms don't permit third-party products to use Claude.ai subscription login), so an open-source app built on that would be fragile and against the providers' terms. The Parent instead supplies a provider API key (Anthropic, OpenAI, …) as an environment variable only — never stored in SQLite, markdown or logs; the chosen provider and model are the only LLM settings kept in the database. The Tutor talks to models only through a small provider interface so new providers can be added without touching tutoring logic.

## Considered Options

- **Shell out to a locally installed `claude` CLI logged in with a subscription**: rejected for the published app; could be revisited as an adapter behind the same provider interface if the terms clearly allow it.
