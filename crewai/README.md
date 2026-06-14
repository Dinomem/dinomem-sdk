# dinomem-crewai

[CrewAI](https://crewai.com) integration for [DinoMem](https://dinomem-dashboard.vercel.app). Ships two pre-built tools that match the shape of CrewAI's built-in `RecallMemoryTool` / `RememberTool` — agents get hybrid retrieval (semantic + keyword + graph), multi-agent scoping, and Postgres-native storage with one config object.

```bash
pip install dinomem-crewai
```

## Quick start

```python
from crewai import Agent, Crew, Task
from dinomem_crewai import DinoMemConfig, create_dinomem_tools

config = DinoMemConfig(
    api_key="sk-...",
    agent_id="support-bot",
    scope="team",         # optional default
)

support = Agent(
    role="Support specialist",
    goal="Help customers and remember what they prefer.",
    backstory="...",
    tools=create_dinomem_tools(config),
)

crew = Crew(agents=[support], tasks=[Task(...)])
crew.kickoff()
```

The agent now has two tools — `Search memory` and `Save to memory` — that hit DinoMem instead of the local LanceDB/Mem0 default.

## Tools

| Tool | Purpose | Input |
|---|---|---|
| `DinoMemRecallTool` | Hybrid search; returns top hits with scores. | `queries: list[str]` |
| `DinoMemRememberTool` | Writes one or more facts. | `contents: list[str]` |

Both match CrewAI's built-in shape (`name`, `description`, `args_schema`), so agents pick them automatically — you don't have to retrain on tool descriptions.

## Helpers (without tools)

For custom flows — pre-search before a task starts, post-extract facts after a run, etc.:

```python
from dinomem_crewai import add_memory, recall_memories, search_memories

await_text = recall_memories("what does this customer prefer?", config)
# → "Relevant memories...\n- (score=0.85) ..."

hits = search_memories("escalation policy", config)
# → list[MemoryHit]

add_memory("Customer prefers email over phone.", config)
```

## Config reference

| Field | Default | Purpose |
|---|---|---|
| `api_key` | — | Required. |
| `agent_id` | — | Required. |
| `base_url` | hosted | Self-host override. |
| `scope` | private | Default visibility for writes. |
| `role` | — | Default agent role. |
| `workflow_id` | — | Group memories by workflow / session. |
| `top_k` | 5 | Max hits per recall. |
| `rerank` | false | Re-score with Gemini (+0.5-1.5s). |
| `min_score` | 0.0 | Drop hits below this score. |

## Comparison

CrewAI's built-in memory uses LanceDB (or Mem0 if configured). This package gives you DinoMem's Postgres-native, multi-agent-aware memory layer through the same tool interface — no `Memory` rewrite, no separate storage layer.

## License

[Apache-2.0](../LICENSE)
