# @agentmem/mcp

MCP (Model Context Protocol) server for [AgentMem](https://agentmem.dev). Adds shared memory to any MCP-compatible agent — Claude Desktop, Claude Code, Cursor, Continue, and others.

## Install (one block)

### Claude Desktop / Claude Code

Add to your MCP client config (`claude_desktop_config.json` or the equivalent):

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

Get a key at [agentmem.dev](https://agentmem.dev). Restart your client.

### Cursor

Same shape as above, under `.cursor/mcp.json` or your global MCP config.

## Tools

| Name | Purpose |
|---|---|
| `memory_write` | Persist a fact to long-term memory. |
| `memory_search` | Hybrid retrieval (semantic + keyword + graph). |
| `memory_get` | Fetch a memory by id. |
| `memory_delete` | Soft-delete a memory. |
| `memory_check_conflicts` | Detect contradictions before a write. |
| `scratch_set` | Store transient working memory (with optional TTL). |
| `scratch_get` | Read a scratchpad key. |
| `workflow_summarize` | Generate a Markdown brief over all memories in a workflow. |

## Environment variables

| Name | Required? | Default |
|---|---|---|
| `AGENTMEM_API_KEY` | yes | — |
| `AGENTMEM_BASE_URL` | no | AgentMem's hosted API |

## Self-hosting

Point `AGENTMEM_BASE_URL` at your own AgentMem instance. The server is a thin wrapper around [`@agentmem/sdk`](../typescript) — anything the SDK supports, this exposes.

## License

[Apache-2.0](../LICENSE)
