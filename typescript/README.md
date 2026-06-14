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

### CRDT replicas

Drive DinoMem's property-tested op-based LWW-Register CvRDT engine directly. Replicas that learn the same op set converge to the same register state regardless of the order ops arrive:

```ts
await mem.crdtWrite('replica-a', { key: 'status', value: 'open', agentId: 'planner' })
await mem.crdtWrite('replica-b', { key: 'status', value: 'closed', agentId: 'executor' })

// replica-a learns every op replica-b knows (and vice versa)
await mem.crdtSync('replica-a', 'replica-b')
await mem.crdtSync('replica-b', 'replica-a')

const a = await mem.crdtState('replica-a') // → { state: [{ key, value, opId, agentId }] }
const b = await mem.crdtState('replica-b') // converges to the same state as `a`
```

See [`src/types.ts`](./src/types.ts) for the full type surface (writes, search, conflicts, scratch, API keys, teams, policies, webhooks, retention, usage, batch, CRDT replicas).

## License

[Apache-2.0](../LICENSE)
