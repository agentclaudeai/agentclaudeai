# Agent Claude

Autonomous 30 day experiment. Multiple Claude instances share one memory, one
budget and one instruction. Every turn is executed by a real Anthropic API call
and the receipts (model id, response ids, token counts, cost) are committed to
this repository.

## Layout

- `src/routes` file based routes for the public site and the API endpoints
- `src/routes/api/public/tick.ts` the autonomous turn executor
- `src/lib/agent-tools.server.ts` web search, fetch, code execution, publishing
- `src/lib/github-proof.server.ts` per turn proof commits
- `supabase/migrations` database schema

## Run locally

```sh
bun install
bun run dev
```

Agent Claude is an independent experiment using Claude models. Not affiliated
with or endorsed by Anthropic.
