# @dinomem/claude-agent

[DinoMem](https://dinomem-dashboard.vercel.app) integration for the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript). Drops in two ways:

1. **In-process MCP server** — gives the agent 8 memory tools (`memory_write`, `memory_search`, etc.) without spawning a separate process.
2. **`UserPromptSubmit` hook** — auto-recalls relevant memories on every user turn so the agent has context *without ever calling a tool*.

```bash
npm install @dinomem/claude-agent @anthropic-ai/claude-agent-sdk zod
```

## Quick start

```ts
import { query } from '@anthropic-ai/claude-agent-sdk'
import { dinomemMcpServer, dinomemRecallHook } from '@dinomem/claude-agent'

const config = {
  apiKey:  process.env.DINOMEM_API_KEY!,
  agentId: 'support-bot',
}

const result = query({
  prompt: 'help me debug this',
  options: {
    mcpServers: {
      dinomem: dinomemMcpServer(config),
    },
    hooks: {
      UserPromptSubmit: [{ hooks: [dinomemRecallHook(config)] }],
    },
  },
})

for await (const msg of result) {
  // ...
}
```

## What each piece does

### `dinomemMcpServer(config)`

Returns an `McpSdkServerConfigWithInstance` from `createSdkMcpServer`. The agent gets these tools:

| Tool | Purpose |
|---|---|
| `memory_write` | Persist a fact to long-term memory. |
| `memory_search` | Hybrid retrieval (semantic + keyword + graph). |
| `memory_get` | Fetch a memory by id. |
| `memory_delete` | Soft-delete a memory. |
| `memory_check_conflicts` | Detect contradictions before a write. |
| `scratch_set` | Store transient working memory with optional TTL. |
| `scratch_get` | Read a scratchpad key. |
| `workflow_summarize` | Generate a Markdown brief over a workflow's memories. |

Tool descriptions are model-facing — Claude picks the right one without prompting hints.

### `dinomemRecallHook(config)`

A `UserPromptSubmit` hook that, on every user turn:

1. Searches DinoMem with the user's prompt as the query.
2. Returns the top hits as `additionalContext`, which the SDK splices into the model's prompt.

The agent never has to decide to call a tool — memories just *appear* in context. If search fails for any reason (network, auth), the hook logs to stderr and returns `{}`, so the turn proceeds normally.

Config:

| Option | Default | Purpose |
|---|---|---|
| `apiKey` | — | Required. |
| `agentId` | — | Required. |
| `baseUrl` | hosted | Self-host override. |
| `workflowId` | — | Limit to a workflow. |
| `scope` | all | Limit to private/team/global. |
| `topK` | 5 | Number of hits per turn. |
| `rerank` | false | Re-score with Gemini (+0.5-1.5s). |
| `minScore` | 0 | Minimum score to inject. With `rerank: true`, compared against `relevance_score` (0–1). Hits where `relevance_score` is `null` (rerank failed, e.g. Gemini rate-limit) are always dropped, never compared against the raw `score`. |
| `prefix` | default preamble | Custom text before the memory list. |

## Choosing between tools and the hook

- **Tools only**: agent decides when to recall/write. Lower latency on simple turns; agent might miss memories it doesn't think to look for.
- **Hook only**: every turn gets fresh context, no agent code needed. Adds one API call per turn.
- **Both**: hook gives passive context, tools let the agent dig deeper or write durable facts. Recommended for most apps.

## Comparison to `@dinomem/mcp`

`@dinomem/mcp` is a standalone stdio MCP server intended for **client apps** (Claude Desktop, Cursor) that spawn MCP processes. `@dinomem/claude-agent` is intended for **your own Node code** that calls `query()` directly — no separate process, plus the recall hook.

## License

[Apache-2.0](../LICENSE)
