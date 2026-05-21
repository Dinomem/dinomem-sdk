# @agentmem/mastra

[Mastra](https://mastra.ai) integration for [AgentMem](https://agentmem-dashboard.vercel.app) — drop-in memory tools for Mastra agents.

```bash
npm install @agentmem/mastra @mastra/core zod
```

## Quick start

```ts
import { Agent } from '@mastra/core/agent'
import {
  AgentMemIntegration,
  agentmemMemorize,
  agentmemRemember,
} from '@agentmem/mastra'

const agentmem = new AgentMemIntegration({
  apiKey:  process.env.AGENTMEM_API_KEY!,
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
    memorize: agentmemMemorize(agentmem),
    remember: agentmemRemember(agentmem),
  },
})
```

## What it gives you

| Export | Purpose |
|---|---|
| `AgentMemIntegration` | Class wrapping the AgentMem SDK; exposes `createMemory` / `searchMemory` / `searchMemoryRaw`. |
| `agentmemMemorize(integration, defaults?)` | Pre-built Mastra tool. Stores a fact. |
| `agentmemRemember(integration, defaults?)` | Pre-built Mastra tool. Retrieves relevant memories. |
| `MemoryStore`, `AgentMemError`, `Scope`, `Role`, `MemoryHit` | Re-exported from `@agentmem/sdk` for convenience. |

## Defaults and overrides

Constructor `AgentMemConfig` accepts default `agentId`, `scope`, `role`, `workflowId`. Every per-call site (tool input or method argument) can override. The merge order is:

`tool input` > `tool factory defaults` > `integration config` > error if still missing.

`agentId` is the only required field; if it isn't set on the integration AND isn't passed per-call, the tool throws a helpful error.

## Using the integration without tools

If you don't want the pre-built tools (e.g., you're writing custom flows):

```ts
const text = await agentmem.searchMemory('what does the customer prefer?', {
  agentId: 'support-bot',
  topK:    5,
})
// → prompt-prefixed string ready to inject into the model's context

const ack = await agentmem.createMemory('Customer prefers email over phone.', {
  agentId: 'support-bot',
  scope:   'team',
})
// → "Memory saved (id: ...). Content: ..."
```

For raw results without the prompt prefix:

```ts
const hits = await agentmem.searchMemoryRaw('escalation threshold', { agentId: 'support-bot' })
// → MemoryHit[]
```

## License

[Apache-2.0](../LICENSE)
