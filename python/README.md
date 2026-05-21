# agentmem-py

Python SDK for [AgentMem](https://agentmem-dashboard.vercel.app) — the memory API for AI agents.

## Install

```bash
pip install agentmem-py
```

## Usage

```python
import os
from agentmem_py import MemoryStore

mem = MemoryStore(api_key=os.environ["AGENTMEM_API_KEY"])

mem.write(content="user prefers dark mode", agent_id="agent-1", scope="user")
hits = mem.search(query="theme preference", agent_id="agent-1", top_k=5)
for h in hits:
    print(h.score, h.content)
```

### Async

```python
import asyncio
from agentmem_py import AsyncMemoryStore

async def main():
    async with AsyncMemoryStore(api_key="...") as mem:
        await mem.write(content="hello", agent_id="agent-1")

asyncio.run(main())
```

## Self-hosting

Pass `base_url=` to point at your own deployment:

```python
mem = MemoryStore(api_key="...", base_url="https://your-host.example.com/functions/v1/api")
```

## License

[Apache-2.0](../LICENSE)
