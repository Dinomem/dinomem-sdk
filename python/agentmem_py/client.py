"""AgentMem Python SDK — synchronous and async clients."""

from __future__ import annotations

import httpx
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://lwbwcuuzoituanwhekyo.supabase.co/functions/v1/api"


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class MemoryHit:
    id: str
    content: str
    agent_id: str
    scope: str
    role: Optional[str]
    workflow_id: Optional[str]
    created_at: str
    score: float
    vector_clock: Optional[Dict[str, int]] = None


@dataclass
class Conflict:
    memory_id: str
    content: str
    agent_id: str
    severity: str   # 'high' | 'medium' | 'low'
    description: str


# ── Sync client ───────────────────────────────────────────────────────────────

class MemoryStore:
    """Synchronous AgentMem client.

    Usage::

        from agentmem_py import MemoryStore

        mem = MemoryStore(api_key="sk-...")
        result = mem.write("Alice prefers dark mode.", agent_id="support-bot")
        hits = mem.search("What does Alice prefer?", agent_id="support-bot")
    """

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL) -> None:
        self._base = base_url.rstrip("/")
        self._http = httpx.Client(
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    def _post(self, path: str, body: Dict[str, Any]) -> Any:
        r = self._http.post(f"{self._base}{path}", json=body)
        r.raise_for_status()
        return r.json()

    # ── Core memory operations ────────────────────────────────────────────────

    def write(
        self,
        content: str,
        agent_id: str,
        scope: str = "private",
        workflow_id: Optional[str] = None,
        role: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Write a memory. Returns ``{"writeId": str}`` or ``{"writeId": str, "duplicate": True}``."""
        body: Dict[str, Any] = {"content": content, "agentId": agent_id, "scope": scope}
        if workflow_id is not None: body["workflowId"] = workflow_id
        if role is not None:        body["role"] = role
        if expires_at is not None:  body["expiresAt"] = expires_at
        return self._post("/v1/memory/write", body)

    def search(
        self,
        query: str,
        agent_id: str,
        top_k: int = 5,
        scope: Optional[str] = None,
        workflow_id: Optional[str] = None,
        at_time: Optional[str] = None,
    ) -> List[MemoryHit]:
        """Hybrid search (semantic + keyword + graph). Returns ranked ``MemoryHit`` list."""
        body: Dict[str, Any] = {"query": query, "agentId": agent_id, "topK": top_k}
        if scope is not None:       body["scope"] = scope
        if workflow_id is not None: body["workflowId"] = workflow_id
        if at_time is not None:     body["atTime"] = at_time
        rows = self._post("/v1/memory/search", body)
        return [
            MemoryHit(
                id=r["id"], content=r["content"], agent_id=r["agent_id"],
                scope=r["scope"], role=r.get("role"), workflow_id=r.get("workflow_id"),
                created_at=r["created_at"], score=r["score"],
                vector_clock=r.get("vector_clock"),
            )
            for r in rows
        ]

    def delete(self, memory_id: str) -> None:
        """Soft-delete a memory."""
        self._http.delete(f"{self._base}/v1/memory/{memory_id}").raise_for_status()

    def get(self, memory_id: str) -> Dict[str, Any]:
        """Retrieve a single memory by ID."""
        r = self._http.get(f"{self._base}/v1/memory/{memory_id}")
        r.raise_for_status()
        return r.json()

    # ── Conflict detection ────────────────────────────────────────────────────

    def check_conflicts(
        self,
        content: str,
        agent_id: str,
        workflow_id: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> List[Conflict]:
        """Check if ``content`` contradicts any existing memories. Returns ``Conflict`` list."""
        body: Dict[str, Any] = {"content": content, "agentId": agent_id}
        if workflow_id is not None: body["workflowId"] = workflow_id
        if scope is not None:       body["scope"] = scope
        data = self._post("/v1/memory/conflicts", body)
        return [
            Conflict(
                memory_id=c["memoryId"], content=c["content"], agent_id=c["agentId"],
                severity=c["severity"], description=c["description"],
            )
            for c in data.get("conflicts", [])
        ]

    # ── Scratchpad ────────────────────────────────────────────────────────────

    def scratch_set(
        self,
        workflow_id: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> None:
        """Set transient working memory with optional ``ttl`` (seconds)."""
        body: Dict[str, Any] = {"workflowId": workflow_id, "key": key, "value": value}
        if ttl is not None: body["ttl"] = ttl
        self._post("/v1/scratch/set", body)

    def scratch_get(self, workflow_id: str, key: str) -> Optional[Any]:
        """Get transient working memory. Returns ``None`` if absent or expired."""
        return self._post("/v1/scratch/get", {"workflowId": workflow_id, "key": key}).get("value")

    def scratch_del(self, workflow_id: str, key: str) -> None:
        """Delete a scratchpad entry."""
        self._http.post(
            f"{self._base}/v1/scratch/del",
            json={"workflowId": workflow_id, "key": key},
        ).raise_for_status()

    # ── Workflow helpers ──────────────────────────────────────────────────────

    def summarize(self, workflow_id: str) -> Dict[str, Any]:
        """Summarize all memories in a workflow into a markdown brief."""
        r = self._http.post(f"{self._base}/v1/workflows/{workflow_id}/summarize")
        r.raise_for_status()
        return r.json()

    def workflow_memories(self, workflow_id: str) -> List[Dict[str, Any]]:
        """List all active memories for a workflow."""
        r = self._http.get(f"{self._base}/v1/workflows/{workflow_id}/memories")
        r.raise_for_status()
        return r.json()

    # ── API key management ────────────────────────────────────────────────────

    def list_keys(self) -> List[Dict[str, Any]]:
        r = self._http.get(f"{self._base}/v1/keys")
        r.raise_for_status()
        return r.json()

    def create_key(self, name: str, tier: str = "developer", **kwargs) -> Dict[str, Any]:
        """Create a new API key. The raw key is returned only once."""
        body: Dict[str, Any] = {"name": name, "tier": tier}
        body.update(kwargs)
        return self._post("/v1/keys", body)

    def revoke_key(self, key_id: str) -> None:
        self._http.delete(f"{self._base}/v1/keys/{key_id}").raise_for_status()

    # ── Context manager ───────────────────────────────────────────────────────

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "MemoryStore":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


# ── Async client ──────────────────────────────────────────────────────────────

class AsyncMemoryStore:
    """Async AgentMem client (requires httpx).

    Usage::

        from agentmem_py import AsyncMemoryStore

        async with AsyncMemoryStore(api_key="sk-...") as mem:
            await mem.write("Alice prefers dark mode.", agent_id="support-bot")
            hits = await mem.search("Alice preferences", agent_id="support-bot")
    """

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL) -> None:
        self._base = base_url.rstrip("/")
        self._http = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def _post(self, path: str, body: Dict[str, Any]) -> Any:
        r = await self._http.post(f"{self._base}{path}", json=body)
        r.raise_for_status()
        return r.json()

    async def write(
        self,
        content: str,
        agent_id: str,
        scope: str = "private",
        workflow_id: Optional[str] = None,
        role: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"content": content, "agentId": agent_id, "scope": scope}
        if workflow_id is not None: body["workflowId"] = workflow_id
        if role is not None:        body["role"] = role
        if expires_at is not None:  body["expiresAt"] = expires_at
        return await self._post("/v1/memory/write", body)

    async def search(
        self,
        query: str,
        agent_id: str,
        top_k: int = 5,
        scope: Optional[str] = None,
        workflow_id: Optional[str] = None,
        at_time: Optional[str] = None,
    ) -> List[MemoryHit]:
        body: Dict[str, Any] = {"query": query, "agentId": agent_id, "topK": top_k}
        if scope is not None:       body["scope"] = scope
        if workflow_id is not None: body["workflowId"] = workflow_id
        if at_time is not None:     body["atTime"] = at_time
        rows = await self._post("/v1/memory/search", body)
        return [
            MemoryHit(
                id=r["id"], content=r["content"], agent_id=r["agent_id"],
                scope=r["scope"], role=r.get("role"), workflow_id=r.get("workflow_id"),
                created_at=r["created_at"], score=r["score"],
                vector_clock=r.get("vector_clock"),
            )
            for r in rows
        ]

    async def delete(self, memory_id: str) -> None:
        r = await self._http.delete(f"{self._base}/v1/memory/{memory_id}")
        r.raise_for_status()

    async def check_conflicts(
        self,
        content: str,
        agent_id: str,
        workflow_id: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> List[Conflict]:
        body: Dict[str, Any] = {"content": content, "agentId": agent_id}
        if workflow_id is not None: body["workflowId"] = workflow_id
        if scope is not None:       body["scope"] = scope
        data = await self._post("/v1/memory/conflicts", body)
        return [
            Conflict(
                memory_id=c["memoryId"], content=c["content"], agent_id=c["agentId"],
                severity=c["severity"], description=c["description"],
            )
            for c in data.get("conflicts", [])
        ]

    async def scratch_set(
        self,
        workflow_id: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> None:
        body: Dict[str, Any] = {"workflowId": workflow_id, "key": key, "value": value}
        if ttl is not None: body["ttl"] = ttl
        await self._post("/v1/scratch/set", body)

    async def scratch_get(self, workflow_id: str, key: str) -> Optional[Any]:
        data = await self._post("/v1/scratch/get", {"workflowId": workflow_id, "key": key})
        return data.get("value")

    async def summarize(self, workflow_id: str) -> Dict[str, Any]:
        r = await self._http.post(f"{self._base}/v1/workflows/{workflow_id}/summarize")
        r.raise_for_status()
        return r.json()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncMemoryStore":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()
