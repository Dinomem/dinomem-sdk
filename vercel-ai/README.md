# @agentmem/vercel-ai-provider

[Vercel AI SDK](https://ai-sdk.dev) integration for [AgentMem](https://agentmem-dashboard.vercel.app). Three ways to wire it in — use one or stack them.

```bash
npm install @agentmem/vercel-ai-provider ai
```

## Pattern A — middleware (automatic memory injection)

Wrap any `@ai-sdk/*` model and memories appear in the system prompt on every call.

```ts
import { generateText, wrapLanguageModel } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createAgentMemMiddleware } from '@agentmem/vercel-ai-provider'

const cfg = { apiKey: process.env.AGENTMEM_API_KEY!, agentId: 'support-bot' }

const model = wrapLanguageModel({
  model:      anthropic('claude-opus-4-7'),
  middleware: createAgentMemMiddleware(cfg),
})

const { text } = await generateText({ model, prompt: 'What did the customer prefer?' })
```

If search fails, the middleware logs to stderr and lets the call proceed without memory — your model never gets blocked.

## Pattern B — tools

```ts
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { agentmemMemorize, agentmemRecall } from '@agentmem/vercel-ai-provider'

await generateText({
  model:  anthropic('claude-opus-4-7'),
  tools:  {
    memorize: agentmemMemorize(cfg),
    recall:   agentmemRecall(cfg),
  },
  prompt: '...',
})
```

The agent decides when to call `memorize` / `recall`. Lower per-turn latency than the middleware on simple turns.

## Pattern C — helpers (manual control)

Drop-in API replacement for [`@mem0/vercel-ai-provider`](https://www.npmjs.com/package/@mem0/vercel-ai-provider) — same function names.

```ts
import {
  addMemories,
  retrieveMemories,
  searchMemories,
} from '@agentmem/vercel-ai-provider'

await addMemories('User prefers email.', { apiKey, agentId: 'bot' })

const context = await retrieveMemories(userMessage, { apiKey, agentId: 'bot' })
// → "Relevant memories retrieved from AgentMem...\n- User prefers email."
//   Splice into your system prompt manually.

const hits = await searchMemories('what does the user prefer?', { apiKey, agentId: 'bot' })
// → MemoryHit[] for custom rendering
```

## Why this beats `@mem0/vercel-ai-provider`

| | Mem0 provider | AgentMem provider |
|---|---|---|
| Wraps every model SDK | Yes (OpenAI, Anthropic, Cohere, Groq, Google) | No |
| Works with any `@ai-sdk/*` provider | Only the 5 it wraps | All of them |
| Runtime dependency count | 8+ | 1 (`@agentmem/sdk`) |
| Provides middleware | No | Yes |
| Helper API compatibility | — | Same names: `addMemories` / `retrieveMemories` / `searchMemories` |

Migration from Mem0: change the import path, set `AGENTMEM_API_KEY` instead of `MEM0_API_KEY`, and pass `agentId` in the config.

## Config reference

| Field | Default | Purpose |
|---|---|---|
| `apiKey` | — | Required. |
| `agentId` | — | Required (constructor OR per-call). |
| `baseUrl` | hosted | Self-host override. |
| `scope` | private | Visibility default. |
| `workflowId` | — | Group memories under a workflow. |
| `topK` | 5 | Max memories per recall. |
| `rerank` | false | Re-score with Gemini (+0.5-1.5s). |
| `minScore` | 0 | Drop hits below this score. |
| `prefix` | default | Custom text before the memory block (middleware + retrieveMemories). |

## License

[Apache-2.0](../LICENSE)
