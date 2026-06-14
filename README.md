# DinoMem SDK

Official client SDKs for [DinoMem](https://dinomem-dashboard.vercel.app) — the memory API for AI agents.

DinoMem is the Postgres-native memory layer for multi-agent systems — it runs entirely inside your Supabase/Postgres (no separate Redis, Neo4j, or Pinecone) and gives concurrent agents typed, auditable conflict resolution with property-tested CRDT convergence under concurrent writes.

| Language | Package | Source |
|---|---|---|
| TypeScript / JavaScript | [`@dinomem/sdk`](https://www.npmjs.com/package/@dinomem/sdk) | [`./typescript`](./typescript) |
| Python | [`dinomem-py`](https://pypi.org/project/dinomem-py/) | [`./python`](./python) |
| CLI (init) | [`@dinomem/cli`](https://www.npmjs.com/package/@dinomem/cli) | [`./cli`](./cli) |
| MCP server | [`@dinomem/mcp`](https://www.npmjs.com/package/@dinomem/mcp) | [`./mcp`](./mcp) |
| Mastra integration | [`@dinomem/mastra`](https://www.npmjs.com/package/@dinomem/mastra) | [`./mastra`](./mastra) |
| Claude Agent SDK integration | [`@dinomem/claude-agent`](https://www.npmjs.com/package/@dinomem/claude-agent) | [`./claude-agent`](./claude-agent) |
| Vercel AI SDK integration | [`@dinomem/vercel-ai-provider`](https://www.npmjs.com/package/@dinomem/vercel-ai-provider) | [`./vercel-ai`](./vercel-ai) |
| CrewAI integration (Python) | [`dinomem-crewai`](https://pypi.org/project/dinomem-crewai/) | [`./crewai`](./crewai) |

Both SDKs are thin HTTP clients over the DinoMem REST API. They have no server-side dependencies and no proprietary code — the API itself is a separate (closed-source) project.

## One-command setup

In an existing TypeScript or Python project:

```bash
npx @dinomem/cli init
```

The CLI detects your project, installs the right SDK, adds an env placeholder, and drops an `dinomem-example.{ts,py}` demo script. See [`./cli`](./cli) for flags.

## Use it from Claude / Cursor (MCP)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "dinomem": {
      "command": "npx",
      "args":    ["-y", "@dinomem/mcp"],
      "env":     { "DINOMEM_API_KEY": "sk-..." }
    }
  }
}
```

The server exposes 8 tools (`memory_write`, `memory_search`, `memory_get`, `memory_delete`, `memory_check_conflicts`, `scratch_set`, `scratch_get`, `workflow_summarize`). See [`./mcp`](./mcp).

## Use it from a Mastra agent

```ts
import { Agent } from '@mastra/core/agent'
import { DinoMemIntegration, dinomemMemorize, dinomemRemember } from '@dinomem/mastra'

const dinomem = new DinoMemIntegration({ apiKey: process.env.DINOMEM_API_KEY!, agentId: 'bot' })

new Agent({
  name: 'support',
  tools: {
    memorize: dinomemMemorize(dinomem),
    remember: dinomemRemember(dinomem),
  },
})
```

See [`./mastra`](./mastra) for defaults, overrides, and the raw-hits variant.

## Use it from the Claude Agent SDK

```ts
import { query } from '@anthropic-ai/claude-agent-sdk'
import { dinomemMcpServer, dinomemRecallHook } from '@dinomem/claude-agent'

const cfg = { apiKey: process.env.DINOMEM_API_KEY!, agentId: 'bot' }

const result = query({
  prompt: 'help me debug this',
  options: {
    mcpServers: { dinomem: dinomemMcpServer(cfg) },
    hooks:      { UserPromptSubmit: [{ hooks: [dinomemRecallHook(cfg)] }] },
  },
})
```

You get both an in-process MCP server (8 memory tools) and a `UserPromptSubmit` hook that auto-injects relevant memories on every turn. See [`./claude-agent`](./claude-agent).

## Use it from the Vercel AI SDK

```ts
import { generateText, wrapLanguageModel } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createDinoMemMiddleware } from '@dinomem/vercel-ai-provider'

const model = wrapLanguageModel({
  model:      anthropic('claude-opus-4-7'),
  middleware: createDinoMemMiddleware({ apiKey: process.env.DINOMEM_API_KEY!, agentId: 'bot' }),
})

const { text } = await generateText({ model, prompt: '...' })
```

Middleware auto-injects relevant memories on every call; tools and helpers are also exported. Works with any `@ai-sdk/*` model — no provider lock-in. See [`./vercel-ai`](./vercel-ai).

## Use it from a CrewAI agent (Python)

```python
from crewai import Agent
from dinomem_crewai import DinoMemConfig, create_dinomem_tools

config = DinoMemConfig(api_key="sk-...", agent_id="support-bot")

agent = Agent(
    role="Support",
    goal="Help customers and remember preferences",
    backstory="...",
    tools=create_dinomem_tools(config),
)
```

Drop-in replacements for CrewAI's built-in `RecallMemoryTool` / `RememberTool`, backed by DinoMem instead of LanceDB. See [`./crewai`](./crewai).

## Benchmark

Methodology and reproducible harness for comparing DinoMem against Mem0, Zep, Cognee, Supermemory, LangMem, and a pgvector baseline on **multi-agent** memory scenarios (contradictions, CRDT convergence, scope enforcement, temporal queries) lives in a separate repo: [`dinomem-bench`](https://github.com/DinoMem/dinomem-bench). Design phase — implementation in progress.

DinoMem ships CRDT convergence today: an op-based LWW-Register CvRDT engine plus a drivable replica/sync API (`crdtWrite` / `crdtSync` / `crdtState`, over `/v1/crdt`), whose convergence is property-tested and empirically order-independent (order-independence across shuffles, the CvRDT laws, and no-lost-writes vs an independent brute-force reference). DinoMem is the only system under test that exposes a drivable replica/sync API, so it is the only one whose CRDT convergence the benchmark can drive and verify; every other system is structurally N/A on that scenario. The cross-system convergence scenario is engine property-tested and adapter-ready, with the live cross-system run still pending.

## Quick start

### TypeScript

```bash
npm install @dinomem/sdk
```

```ts
import { MemoryStore } from '@dinomem/sdk'

const mem = new MemoryStore({ apiKey: process.env.DINOMEM_API_KEY! })

await mem.write({ content: 'user prefers dark mode', agentId: 'agent-1' })
const hits = await mem.search({ query: 'theme preference', agentId: 'agent-1' })
```

### Python

```bash
pip install dinomem-py
```

```python
from dinomem_py import MemoryStore

mem = MemoryStore(api_key=os.environ["DINOMEM_API_KEY"])

mem.write(content="user prefers dark mode", agent_id="agent-1")
hits = mem.search(query="theme preference", agent_id="agent-1")
```

## Configuration

Both SDKs read the API base URL from constructor options (`baseUrl` / `base_url`). The default points at DinoMem's hosted API; self-hosters can override it to hit their own deployment.

## License

[Apache-2.0](./LICENSE)
