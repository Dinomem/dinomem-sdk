# AgentMem SDK

Official client SDKs for [AgentMem](https://agentmem.dev) — the memory API for AI agents.

| Language | Package | Source |
|---|---|---|
| TypeScript / JavaScript | [`@agentmem/sdk`](https://www.npmjs.com/package/@agentmem/sdk) | [`./typescript`](./typescript) |
| Python | [`agentmem`](https://pypi.org/project/agentmem/) | [`./python`](./python) |

Both SDKs are thin HTTP clients over the AgentMem REST API. They have no server-side dependencies and no proprietary code — the API itself is a separate (closed-source) project.

## Quick start

### TypeScript

```bash
npm install @agentmem/sdk
```

```ts
import { MemoryStore } from '@agentmem/sdk'

const mem = new MemoryStore({ apiKey: process.env.AGENTMEM_API_KEY! })

await mem.write({ content: 'user prefers dark mode', agentId: 'agent-1' })
const hits = await mem.search({ query: 'theme preference', agentId: 'agent-1' })
```

### Python

```bash
pip install agentmem
```

```python
from agentmem import MemoryStore

mem = MemoryStore(api_key=os.environ["AGENTMEM_API_KEY"])

mem.write(content="user prefers dark mode", agent_id="agent-1")
hits = mem.search(query="theme preference", agent_id="agent-1")
```

## Configuration

Both SDKs read the API base URL from constructor options (`baseUrl` / `base_url`). The default points at AgentMem's hosted API; self-hosters can override it to hit their own deployment.

## License

[Apache-2.0](./LICENSE)
