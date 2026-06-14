# @dinomem/sdk

TypeScript SDK for [DinoMem](https://dinomem-dashboard.vercel.app) — the memory API for AI agents.

## Install

```bash
npm install @dinomem/sdk
# or
pnpm add @dinomem/sdk
# or
yarn add @dinomem/sdk
```

## Usage

```ts
import { MemoryStore } from '@dinomem/sdk'

const mem = new MemoryStore({
  apiKey: process.env.DINOMEM_API_KEY!,
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
