"""AgentMem integration for CrewAI.

Public surface:

- ``AgentMemRecallTool``  — drop-in replacement for CrewAI's built-in recall tool, backed by AgentMem.
- ``AgentMemRememberTool`` — drop-in replacement for the built-in remember tool, backed by AgentMem.
- ``create_agentmem_tools(config)`` — convenience factory returning both tools wired to a single config.
- ``add_memory`` / ``recall_memories`` / ``search_memories`` — helper functions for custom flows.
- ``AgentMemConfig`` — typed config for everything above.
"""

from agentmem_crewai.config import AgentMemConfig
from agentmem_crewai.helpers import add_memory, recall_memories, search_memories
from agentmem_crewai.tools import (
    AgentMemRecallTool,
    AgentMemRememberTool,
    create_agentmem_tools,
)

__all__ = [
    "AgentMemConfig",
    "AgentMemRecallTool",
    "AgentMemRememberTool",
    "add_memory",
    "create_agentmem_tools",
    "recall_memories",
    "search_memories",
]

__version__ = "0.1.0"
