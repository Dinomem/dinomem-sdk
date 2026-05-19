"""Typed configuration for the CrewAI integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

Scope = Literal["private", "team", "global"]
Role = Literal["planner", "executor", "observer"]


@dataclass(frozen=True)
class AgentMemConfig:
    """Configuration for AgentMem CrewAI tools.

    The same config is used by every helper and tool in this package. Once
    you've built tools with a given config, the values are frozen — to change
    them per-call, build a separate set of tools.
    """

    api_key: str
    agent_id: str
    base_url: Optional[str] = None
    scope: Optional[Scope] = None
    role: Optional[Role] = None
    workflow_id: Optional[str] = None
    """Maximum hits returned per recall (default 5)."""
    top_k: int = 5
    """Re-rank top candidates with Gemini for higher precision (adds 0.5-1.5s)."""
    rerank: bool = False
    """Skip hits below this score (use rerank's relevance_score when reranking)."""
    min_score: float = 0.0
