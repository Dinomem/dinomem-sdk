# @agentmem/sdk

TypeScript SDK for [AgentMem](https://agentmem.dev) — the memory API for AI agents.

## Install

```bash
npm install @agentmem/sdk
# or
pnpm add @agentmem/sdk
# or
yarn add @agentmem/sdk
```

## Usage

```ts
import { MemoryStore } from '@agentmem/sdk'

const mem = new MemoryStore({
  apiKey: process.env.AGENTMEM_API_KEY!,
  // baseUrl: 'https://your-self-hosted.example.com/functions/v1/api', // optional
})

await mem.write({
  content: 'user prefers dark mode',
  agentId: 'agent-1',
  scope:   'user',
})

const hits = await mem.search({
  query:   'theme preference',
  agentId: 'agent-1',
  topK:    5,
})
```

See [`src/types.ts`](./src/types.ts) for the full type surface (writes, search, conflicts, scratch, API keys, teams, policies, webhooks, retention, usage, batch).

## License

[Apache-2.0](../LICENSE)
