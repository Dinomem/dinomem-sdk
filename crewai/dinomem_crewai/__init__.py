"""DinoMem integration for CrewAI.

Public surface:

- ``DinoMemRecallTool``  — drop-in replacement for CrewAI's built-in recall tool, backed by DinoMem.
- ``DinoMemRememberTool`` — drop-in replacement for the built-in remember tool, backed by DinoMem.
- ``create_dinomem_tools(config)`` — convenience factory returning both tools wired to a single config.
- ``add_memory`` / ``recall_memories`` / ``search_memories`` — helper functions for custom flows.
- ``DinoMemConfig`` — typed config for everything above.
"""

from dinomem_crewai.config import DinoMemConfig
from dinomem_crewai.helpers import add_memory, recall_memories, search_memories
from dinomem_crewai.tools import (
    DinoMemRecallTool,
    DinoMemRememberTool,
    create_dinomem_tools,
)

__all__ = [
    "DinoMemConfig",
    "DinoMemRecallTool",
    "DinoMemRememberTool",
    "add_memory",
    "create_dinomem_tools",
    "recall_memories",
    "search_memories",
]

__version__ = "0.1.0"
