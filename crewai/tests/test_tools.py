"""Tests for the CrewAI tools and helpers.

Uses ``unittest.mock`` so we don't need network or live DinoMem credentials.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from dinomem_crewai import (
    DinoMemConfig,
    DinoMemRecallTool,
    DinoMemRememberTool,
    add_memory,
    create_dinomem_tools,
    recall_memories,
    search_memories,
)


@pytest.fixture
def config() -> DinoMemConfig:
    return DinoMemConfig(api_key="sk-fake", agent_id="test-agent")


# ── tool shape ──────────────────────────────────────────────────────────────


def test_recall_tool_shape(config: DinoMemConfig):
    tool = DinoMemRecallTool(config=config)
    assert tool.name == "Search memory"
    assert "long-term memory" in tool.description.lower()
    assert tool.args_schema is not None
    # Schema accepts the documented shape
    parsed = tool.args_schema(queries=["one", "two"])
    assert parsed.queries == ["one", "two"]


def test_remember_tool_shape(config: DinoMemConfig):
    tool = DinoMemRememberTool(config=config)
    assert tool.name == "Save to memory"
    assert "save" in tool.description.lower()
    parsed = tool.args_schema(contents=["fact one"])
    assert parsed.contents == ["fact one"]


def test_create_dinomem_tools_returns_both(config: DinoMemConfig):
    tools = create_dinomem_tools(config)
    assert len(tools) == 2
    names = {t.name for t in tools}
    assert names == {"Search memory", "Save to memory"}


# ── recall tool behaviour ───────────────────────────────────────────────────


@patch("dinomem_crewai.helpers.MemoryStore")
def test_recall_tool_run_dedupes_across_queries(mock_cls, config: DinoMemConfig):
    # Two queries return overlapping hits; dedupe by id.
    hit_a = MagicMock(id="m1", content="A", score=0.9)
    hit_b = MagicMock(id="m2", content="B", score=0.7)
    hit_a_dup = MagicMock(id="m1", content="A", score=0.85)

    mock_inst = MagicMock()
    mock_inst.search.side_effect = [[hit_a, hit_b], [hit_a_dup, hit_b]]
    mock_cls.return_value = mock_inst

    tool = DinoMemRecallTool(config=config)
    out = tool._run(queries=["first", "second"])

    assert "Found memories:" in out
    assert out.count("score=") == 2          # 2 unique hits
    assert "A" in out and "B" in out


@patch("dinomem_crewai.helpers.MemoryStore")
def test_recall_tool_run_empty(mock_cls, config: DinoMemConfig):
    mock_inst = MagicMock()
    mock_inst.search.return_value = []
    mock_cls.return_value = mock_inst

    tool = DinoMemRecallTool(config=config)
    assert tool._run(queries=["nothing"]) == "No relevant memories found."


@patch("dinomem_crewai.helpers.MemoryStore")
def test_recall_tool_accepts_string_query(mock_cls, config: DinoMemConfig):
    mock_inst = MagicMock()
    mock_inst.search.return_value = []
    mock_cls.return_value = mock_inst

    tool = DinoMemRecallTool(config=config)
    # CrewAI's built-in handles both shapes; we should too.
    assert tool._run(queries="single string") == "No relevant memories found."
    mock_inst.search.assert_called_once()


# ── remember tool behaviour ─────────────────────────────────────────────────


@patch("dinomem_crewai.tools._client")
def test_remember_tool_single(mock_client, config: DinoMemConfig):
    mock_inst = MagicMock()
    mock_inst.write.return_value = {"writeId": "abc-123"}
    mock_client.return_value = mock_inst

    tool = DinoMemRememberTool(config=config)
    out = tool._run(contents=["one fact"])
    assert "abc-123" in out
    assert "Saved 1 memory" in out
    mock_inst.write.assert_called_once_with(
        content="one fact",
        agent_id="test-agent",
        scope="private",
        workflow_id=None,
        role=None,
    )


@patch("dinomem_crewai.tools._client")
def test_remember_tool_multiple(mock_client, config: DinoMemConfig):
    mock_inst = MagicMock()
    mock_inst.write.side_effect = [{"writeId": "a"}, {"writeId": "b"}, {"writeId": "c"}]
    mock_client.return_value = mock_inst

    tool = DinoMemRememberTool(config=config)
    out = tool._run(contents=["x", "y", "z"])
    assert "Saved 3 memories" in out
    assert mock_inst.write.call_count == 3


# ── helpers ─────────────────────────────────────────────────────────────────


@patch("dinomem_crewai.helpers.MemoryStore")
def test_search_memories_returns_empty_for_empty_query(_mock_cls, config):
    assert search_memories("", config) == []


@patch("dinomem_crewai.helpers.MemoryStore")
def test_recall_memories_returns_empty_string_for_no_hits(mock_cls, config):
    mock_inst = MagicMock()
    mock_inst.search.return_value = []
    mock_cls.return_value = mock_inst
    assert recall_memories("anything", config) == ""


@patch("dinomem_crewai.helpers.MemoryStore")
def test_recall_memories_formats_with_preamble(mock_cls, config):
    hit = MagicMock(id="m", content="fact", score=0.9)
    mock_inst = MagicMock()
    mock_inst.search.return_value = [hit]
    mock_cls.return_value = mock_inst

    out = recall_memories("query", config)
    assert "Relevant memories retrieved from DinoMem" in out
    assert "- (score=0.90) fact" in out


@patch("dinomem_crewai.helpers.MemoryStore")
def test_add_memory_passes_scope_default(mock_cls, config):
    mock_inst = MagicMock()
    mock_inst.write.return_value = {"writeId": "id-1"}
    mock_cls.return_value = mock_inst

    add_memory("hello", config)
    mock_inst.write.assert_called_once_with(
        content="hello",
        agent_id="test-agent",
        scope="private",
        workflow_id=None,
        role=None,
    )


@patch("dinomem_crewai.helpers.MemoryStore")
def test_min_score_filters_low_hits(mock_cls):
    hits = [
        MagicMock(id="a", content="low",  score=0.3),
        MagicMock(id="b", content="high", score=0.9),
    ]
    mock_inst = MagicMock()
    mock_inst.search.return_value = hits
    mock_cls.return_value = mock_inst

    cfg = DinoMemConfig(api_key="sk", agent_id="a", min_score=0.5)
    out = search_memories("q", cfg)
    assert len(out) == 1
    assert out[0].content == "high"
