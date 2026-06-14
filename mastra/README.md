# @dinomem/mastra

[Mastra](https://mastra.ai) integration for [DinoMem](https://dinomem-dashboard.vercel.app) — drop-in memory tools for Mastra agents.

```bash
npm install @dinomem/mastra @mastra/core zod
```

## Quick start

```ts
import { Agent } from '@mastra/core/agent'
import {
  DinoMemIntegration,
  dinomemMemorize,
  dinomemRemember,
} from '@dinomem/mastra'

const dinomem = new DinoMemIntegration({
  apiKey:  process.env.DINOMEM_API_KEY!,
  agentId: 'support-bot',            // default; tools can override per-call
  scope:   'team',                   // optional default
})

const agent = new Agent({
  name: 'support',
  instructions:
    'You help customers. When you learn a durable fact (preference, decision, ' +
    'constraint), call `memorize`. Before answering, call `remember` to recall ' +
    'prior context.',
  tools: {
    memorize: dinomemMemorize(dinomem),
    remember: dinomemRemember(dinomem),
  },
})
```

## What it gives you

| Export | Purpose |
|---|---|
| `DinoMemIntegration` | Class wrapping the DinoMem SDK; exposes `createMemory` / `searchMemory` / `searchMemoryRaw`. |
| `dinomemMemorize(integration, defaults?)` | Pre-built Mastra tool. Stores a fact. |
| `dinomemRemember(integration, defaults?)` | Pre-built Mastra tool. Retrieves relevant memories. |
| `MemoryStore`, `DinoMemError`, `Scope`, `Role`, `MemoryHit` | Re-exported from `@dinomem/sdk` for convenience. |

## Defaults and overrides

Constructor `DinoMemConfig` accepts default `agentId`, `scope`, `role`, `workflowId`. Every per-call site (tool input or method argument) can override. The merge order is:

`tool input` > `tool factory defaults` > `integration config` > error if still missing.

`agentId` is the only required field; if it isn't set on the integration AND isn't passed per-call, the tool throws a helpful error.

## Using the integration without tools

If you don't want the pre-built tools (e.g., you're writing custom flows):

```ts
const text = await dinomem.searchMemory('what does the customer prefer?', {
  agentId: 'support-bot',
  topK:    5,
})
// → prompt-prefixed string ready to inject into the model's context

const ack = await dinomem.createMemory('Customer prefers email over phone.', {
  agentId: 'support-bot',
  scope:   'team',
})
// → "Memory saved (id: ...). Content: ..."
```

For raw results without the prompt prefix:

```ts
const hits = await dinomem.searchMemoryRaw('escalation threshold', { agentId: 'support-bot' })
// → MemoryHit[]
```

## License

[Apache-2.0](../LICENSE)
