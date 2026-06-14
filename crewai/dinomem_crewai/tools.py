"""CrewAI ``BaseTool`` implementations backed by DinoMem.

Mirrors the shape of CrewAI's built-in ``RecallMemoryTool`` / ``RememberTool``
(in ``crewai/tools/memory_tools.py``) so they're a direct drop-in.
"""

from __future__ import annotations

from typing import Any, Union

from crewai.tools.base_tool import BaseTool
from pydantic import BaseModel, Field

from dinomem_crewai.config import DinoMemConfig
from dinomem_crewai.helpers import _client, search_memories


# ── Schemas ──────────────────────────────────────────────────────────────────


class _RecallArgs(BaseModel):
    """Schema for the recall tool — matches CrewAI's RecallMemorySchema."""

    queries: list[str] = Field(
        ...,
        description=(
            "One or more search queries. Pass a single item for a focused search, "
            "or multiple items to search for several things at once."
        ),
    )


class _RememberArgs(BaseModel):
    """Schema for the remember tool — matches CrewAI's RememberSchema."""

    contents: list[str] = Field(
        ...,
        description=(
            "One or more facts, decisions, or observations to remember. "
            "Pass a single item or multiple items at once."
        ),
    )


# ── Tools ────────────────────────────────────────────────────────────────────


class DinoMemRecallTool(BaseTool):
    """CrewAI tool that recalls relevant facts from DinoMem.

    Replace the built-in ``RecallMemoryTool`` with this to get hybrid retrieval
    (semantic + keyword + graph) and multi-agent scoping at no extra config.
    """

    name: str = "Search memory"
    description: str = (
        "Search long-term memory for facts relevant to one or more queries. "
        "Use this when you need context the conversation has not provided "
        "(past decisions, user preferences, prior work)."
    )
    args_schema: type[BaseModel] = _RecallArgs
    config: DinoMemConfig = Field(exclude=True)

    def _run(self, queries: Union[list[str], str], **_: Any) -> str:
        if isinstance(queries, str):
            queries = [queries]

        lines: list[str] = []
        seen: set[str] = set()
        for q in queries:
            for h in search_memories(q, self.config):
                if h.id not in seen:
                    seen.add(h.id)
                    lines.append(f"- (score={h.score:.2f}) {h.content}")

        if not lines:
            return "No relevant memories found."
        return "Found memories:\n" + "\n".join(lines)


class DinoMemRememberTool(BaseTool):
    """CrewAI tool that stores facts in DinoMem."""

    name: str = "Save to memory"
    description: str = (
        "Save one or more facts, decisions, or constraints to long-term memory "
        "so future runs can recall them. Use sparingly — durable facts only."
    )
    args_schema: type[BaseModel] = _RememberArgs
    config: DinoMemConfig = Field(exclude=True)

    def _run(self, contents: Union[list[str], str], **_: Any) -> str:
        if isinstance(contents, str):
            contents = [contents]

        mem = _client(self.config)
        ids: list[str] = []
        for c in contents:
            res = mem.write(
                content=c,
                agent_id=self.config.agent_id,
                scope=self.config.scope or "private",
                workflow_id=self.config.workflow_id,
                role=self.config.role,
            )
            ids.append(res.get("writeId", ""))

        n = len(contents)
        return (
            f"Saved 1 memory (id: {ids[0]})."
            if n == 1
            else f"Saved {n} memories (ids: {', '.join(filter(None, ids))})."
        )


# ── Factory ─────────────────────────────────────────────────────────────────


def create_dinomem_tools(config: DinoMemConfig) -> list[BaseTool]:
    """Return both recall + remember tools wired to a shared config.

    Matches CrewAI's ``create_memory_tools`` factory shape so you can swap one
    for the other:

    .. code-block:: python

        from crewai import Agent
        from dinomem_crewai import DinoMemConfig, create_dinomem_tools

        config = DinoMemConfig(api_key="sk-...", agent_id="support-bot")
        agent = Agent(
            role="Support",
            goal="Help customers",
            backstory="...",
            tools=create_dinomem_tools(config),
        )
    """
    return [DinoMemRecallTool(config=config), DinoMemRememberTool(config=config)]
