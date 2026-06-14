# @dinomem/vercel-ai-provider

[Vercel AI SDK](https://ai-sdk.dev) integration for [DinoMem](https://dinomem-dashboard.vercel.app). Three ways to wire it in — use one or stack them.

```bash
npm install @dinomem/vercel-ai-provider ai
```

## Pattern A — middleware (automatic memory injection)

Wrap any `@ai-sdk/*` model and memories appear in the system prompt on every call. Works the same for `generateText`, `streamText`, and `generateObject` — they all route through the model's `doGenerate` / `doStream` hook, which is where the middleware fires.

```ts
import { generateText, wrapLanguageModel } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createDinoMemMiddleware, type LanguageModel } from '@dinomem/vercel-ai-provider'

const cfg = { apiKey: process.env.DINOMEM_API_KEY!, agentId: 'support-bot' }

const baseModel: LanguageModel = anthropic('claude-opus-4-7')
const model = wrapLanguageModel({
  model:      baseModel,
  middleware: createDinoMemMiddleware(cfg),
})

const { text } = await generateText({ model, prompt: 'What did the customer prefer?' })
```

> **Note on `LanguageModel`.** Import the type from this package, not from `ai`. The `ai` SDK's `LanguageModel` alias is a *union* (`string | LanguageModelV3 | LanguageModelV2`) for high-level helpers that accept a model id; that union doesn't satisfy `wrapLanguageModel`, which needs the object form only. This package re-exports the right shape.

### Structured output (`generateObject`) works the same way

Wrap the model exactly as above and use `generateObject` directly — the middleware injects memory into the prompt before the model sees it, and the structured schema is preserved.

```ts
import { generateObject } from 'ai'
import { z } from 'zod'

const { object } = await generateObject({
  model,
  schema: z.object({ verdict: z.enum(['approve', 'reject']), reasoning: z.string() }),
  prompt: 'Should we approve this purchase request?',
})
```

If search fails, the middleware logs to stderr and lets the call proceed without memory — your model never gets blocked.

## Pattern B — tools

```ts
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { dinomemMemorize, dinomemRecall } from '@dinomem/vercel-ai-provider'

await generateText({
  model:  anthropic('claude-opus-4-7'),
  tools:  {
    memorize: dinomemMemorize(cfg),
    recall:   dinomemRecall(cfg),
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
} from '@dinomem/vercel-ai-provider'

await addMemories('User prefers email.', { apiKey, agentId: 'bot' })

const context = await retrieveMemories(userMessage, { apiKey, agentId: 'bot' })
// → "Relevant memories retrieved from DinoMem...\n- User prefers email."
//   Splice into your system prompt manually.

const hits = await searchMemories('what does the user prefer?', { apiKey, agentId: 'bot' })
// → MemoryHit[] for custom rendering
```

## Why this beats `@mem0/vercel-ai-provider`

| | Mem0 provider | DinoMem provider |
|---|---|---|
| Wraps every model SDK | Yes (OpenAI, Anthropic, Cohere, Groq, Google) | No |
| Works with any `@ai-sdk/*` provider | Only the 5 it wraps | All of them |
| Runtime dependency count | 8+ | 1 (`@dinomem/sdk`) |
| Provides middleware | No | Yes |
| Helper API compatibility | — | Same names: `addMemories` / `retrieveMemories` / `searchMemories` |

Migration from Mem0: change the import path, set `DINOMEM_API_KEY` instead of `MEM0_API_KEY`, and pass `agentId` in the config.

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
