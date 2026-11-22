# Everything runs in the app, not n8n

The other demos in this workspace (Lead Capture, Real Work Systems, Monday Brief) run their AI calls and 24-hour cleanup in n8n workflows. This project deliberately does not: AI calls run in the Next.js server code through one AI module, and the Sandbox reset is an hourly pg_cron job inside the database. Zeki's portfolio already shows workflow automation; this project exists to show a complete app written as code, so moving these pieces into n8n would defeat its purpose.

## Consequences

- No n8n instance is needed to run, test or reset the app.
- The OpenAI call pattern (plain HTTP to the Responses API, `gpt-5.4-mini`) is reused from the other demos, but rewritten in TypeScript rather than copied as workflow nodes.
