# AgentMem SDK

Official client SDKs for [AgentMem](https://agentmem.dev) — the memory API for AI agents.

| Language | Package | Source |
|---|---|---|
| TypeScript / JavaScript | [`@agentmem/sdk`](https://www.npmjs.com/package/@agentmem/sdk) | [`./typescript`](./typescript) |
| Python | [`agentmem-py`](https://pypi.org/project/agentmem-py/) | [`./python`](./python) |
| CLI (init) | [`@agentmem/cli`](https://www.npmjs.com/package/@agentmem/cli) | [`./cli`](./cli) |
| MCP server | [`@agentmem/mcp`](https://www.npmjs.com/package/@agentmem/mcp) | [`./mcp`](./mcp) |
| Mastra integration | [`@agentmem/mastra`](https://www.npmjs.com/package/@agentmem/mastra) | [`./mastra`](./mastra) |
| Claude Agent SDK integration | [`@agentmem/claude-agent`](https://www.npmjs.com/package/@agentmem/claude-agent) | [`./claude-agent`](./claude-agent) |
| Vercel AI SDK integration | [`@agentmem/vercel-ai-provider`](https://www.npmjs.com/package/@agentmem/vercel-ai-provider) | [`./vercel-ai`](./vercel-ai) |
| CrewAI integration (Python) | [`agentmem-crewai`](https://pypi.org/project/agentmem-crewai/) | [`./crewai`](./crewai) |

Both SDKs are thin HTTP clients over the AgentMem REST API. They have no server-side dependencies and no proprietary code — the API itself is a separate (closed-source) project.

## One-command setup

In an existing TypeScript or Python project:

```bash
npx @agentmem/cli init
```

The CLI detects your project, installs the right SDK, adds an env placeholder, and drops an `agentmem-example.{ts,py}` demo script. See [`./cli`](./cli) for flags.

## Use it from Claude / Cursor (MCP)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "agentmem": {
      "command": "npx",
      "args":    ["-y", "@agentmem/mcp"],
      "env":     { "AGENTMEM_API_KEY": "sk-..." }
    }
  }
}
```

The server exposes 8 tools (`memory_write`, `memory_search`, `memory_get`, `memory_delete`, `memory_check_conflicts`, `scratch_set`, `scratch_get`, `workflow_summarize`). See [`./mcp`](./mcp).

## Use it from a Mastra agent

```ts
import { Agent } from '@mastra/core/agent'
import { AgentMemIntegration, agentmemMemorize, agentmemRemember } from '@agentmem/mastra'

const agentmem = new AgentMemIntegration({ apiKey: process.env.AGENTMEM_API_KEY!, agentId: 'bot' })

new Agent({
  name: 'support',
  tools: {
    memorize: agentmemMemorize(agentmem),
    remember: agentmemRemember(agentmem),
  },
})
```

See [`./mastra`](./mastra) for defaults, overrides, and the raw-hits variant.

## Use it from the Claude Agent SDK

```ts
import { query } from '@anthropic-ai/claude-agent-sdk'
import { agentmemMcpServer, agentmemRecallHook } from '@agentmem/claude-agent'

const cfg = { apiKey: process.env.AGENTMEM_API_KEY!, agentId: 'bot' }

const result = query({
  prompt: 'help me debug this',
  options: {
    mcpServers: { agentmem: agentmemMcpServer(cfg) },
    hooks:      { UserPromptSubmit: [{ hooks: [agentmemRecallHook(cfg)] }] },
  },
})
```

You get both an in-process MCP server (8 memory tools) and a `UserPromptSubmit` hook that auto-injects relevant memories on every turn. See [`./claude-agent`](./claude-agent).

## Use it from the Vercel AI SDK

```ts
import { generateText, wrapLanguageModel } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createAgentMemMiddleware } from '@agentmem/vercel-ai-provider'

const model = wrapLanguageModel({
  model:      anthropic('claude-opus-4-7'),
  middleware: createAgentMemMiddleware({ apiKey: process.env.AGENTMEM_API_KEY!, agentId: 'bot' }),
})

const { text } = await generateText({ model, prompt: '...' })
```

Middleware auto-injects relevant memories on every call; tools and helpers are also exported. Works with any `@ai-sdk/*` model — no provider lock-in. See [`./vercel-ai`](./vercel-ai).

## Use it from a CrewAI agent (Python)

```python
from crewai import Agent
from agentmem_crewai import AgentMemConfig, create_agentmem_tools

config = AgentMemConfig(api_key="sk-...", agent_id="support-bot")

agent = Agent(
    role="Support",
    goal="Help customers and remember preferences",
    backstory="...",
    tools=create_agentmem_tools(config),
)
```

Drop-in replacements for CrewAI's built-in `RecallMemoryTool` / `RememberTool`, backed by AgentMem instead of LanceDB. See [`./crewai`](./crewai).

## Quick start

### TypeScript

```bash
npm install @agentmem/sdk
```

```ts
import { MemoryStore } from '@agentmem/sdk'

const mem = new MemoryStore({ apiKey: process.env.AGENTMEM_API_KEY! })

await mem.write({ content: 'user prefers dark mode', agentId: 'agent-1' })
const hits = await mem.search({ query: 'theme preference', agentId: 'agent-1' })
```

### Python

```bash
pip install agentmem-py
```

```python
from agentmem_py import MemoryStore

mem = MemoryStore(api_key=os.environ["AGENTMEM_API_KEY"])

mem.write(content="user prefers dark mode", agent_id="agent-1")
hits = mem.search(query="theme preference", agent_id="agent-1")
```

## Configuration

Both SDKs read the API base URL from constructor options (`baseUrl` / `base_url`). The default points at AgentMem's hosted API; self-hosters can override it to hit their own deployment.

## License

[Apache-2.0](./LICENSE)
