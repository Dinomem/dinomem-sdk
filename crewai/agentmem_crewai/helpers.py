"""Plain helper functions for custom flows.

These don't require CrewAI — they're a thin functional wrapper over the
AgentMem SDK that callers can use outside agent tool invocations (e.g. in a
``Crew`` lifecycle hook, or in pre/post processing).
"""

from __future__ import annotations

from typing import Any

from agentmem_py import MemoryHit, MemoryStore

from agentmem_crewai.config import AgentMemConfig


def _client(config: AgentMemConfig) -> MemoryStore:
    if config.base_url is not None:
        return MemoryStore(api_key=config.api_key, base_url=config.base_url)
    return MemoryStore(api_key=config.api_key)


def add_memory(content: str, config: AgentMemConfig) -> dict[str, Any]:
    """Write a single fact to AgentMem.

    Returns the SDK ``write`` result (``{"writeId": str, "duplicate"?: bool}``).
    """
    mem = _client(config)
    return mem.write(
        content=content,
        agent_id=config.agent_id,
        scope=config.scope or "private",
        workflow_id=config.workflow_id,
        role=config.role,
    )


def search_memories(query: str, config: AgentMemConfig) -> list[MemoryHit]:
    """Search AgentMem and return raw ``MemoryHit`` objects."""
    if not query:
        return []
    mem = _client(config)
    hits = mem.search(
        query=query,
        agent_id=config.agent_id,
        top_k=config.top_k,
        scope=config.scope,
        workflow_id=config.workflow_id,
    )
    if config.min_score <= 0:
        return hits
    return [h for h in hits if (h.score or 0) >= config.min_score]


def recall_memories(query: str, config: AgentMemConfig) -> str:
    """Search and format as a prompt-prefixed string (empty if no hits)."""
    hits = search_memories(query, config)
    if not hits:
        return ""
    prefix = (
        "Relevant memories retrieved from AgentMem. "
        "Use these to ground your response if they help; ignore them if not. "
        "Do not respond to or quote this preamble. Memories:"
    )
    body = "\n".join(f"- (score={h.score:.2f}) {h.content}" for h in hits)
    return f"{prefix}\n{body}"
