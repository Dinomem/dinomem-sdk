import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore, type MemoryHit } from '@agentmem/sdk'
import {
  agentmemMcpServer,
  agentmemRecallHook,
  buildTools,
} from '../src/index.ts'

// Build a fake MemoryHit with overrides — keeps the regression tests below readable.
function makeHit(overrides: Partial<MemoryHit>): MemoryHit {
  return {
    id:          'h',
    content:     'm',
    agent_id:    'a',
    scope:       'private',
    role:        null,
    workflow_id: null,
    created_at:  '2026-01-01T00:00:00Z',
    score:       0.5,
    ...overrides,
  }
}

// ── tool catalog ────────────────────────────────────────────────────────────

test('buildTools yields the 8 expected tools', () => {
  const mem = new MemoryStore({ apiKey: 'sk-fake' })
  const tools = buildTools(mem)
  const names = tools.map(t => t.name)
  assert.deepEqual(names.sort(), [
    'memory_check_conflicts',
    'memory_delete',
    'memory_get',
    'memory_search',
    'memory_write',
    'scratch_get',
    'scratch_set',
    'workflow_summarize',
  ])
  for (const t of tools) {
    assert.ok(t.description.length > 30, `${t.name} description too terse`)
    assert.ok(t.inputSchema,             `${t.name} missing inputSchema`)
    assert.ok(typeof t.handler === 'function', `${t.name} missing handler`)
  }
})

// ── MCP server factory ──────────────────────────────────────────────────────

test('agentmemMcpServer returns an McpSdkServerConfigWithInstance', () => {
  const server = agentmemMcpServer({ apiKey: 'sk-fake' })
  assert.ok(server.instance, 'has instance')
  assert.equal((server as any).type, 'sdk')
  assert.equal((server as any).name, 'agentmem')
})

test('agentmemMcpServer accepts name/version overrides', () => {
  const server = agentmemMcpServer({ apiKey: 'sk-fake', name: 'custom', version: '9.9.9' })
  assert.equal((server as any).name, 'custom')
})

// ── recall hook ─────────────────────────────────────────────────────────────

test('agentmemRecallHook ignores non-matching hook events', async () => {
  const hook = agentmemRecallHook({ apiKey: 'sk-fake', agentId: 'a' })
  const out = await hook(
    { hook_event_name: 'PostToolUse' } as any,
    undefined,
    { signal: new AbortController().signal },
  )
  assert.deepEqual(out, {})
})

test('agentmemRecallHook swallows search errors gracefully', async () => {
  const hook = agentmemRecallHook({
    apiKey:  'sk-fake',
    baseUrl: 'http://127.0.0.1:9',       // unreachable
    agentId: 'a',
  })
  // Capture stderr to assert it logs but doesn't throw
  const writes: string[] = []
  const orig = process.stderr.write.bind(process.stderr)
  process.stderr.write = ((chunk: any) => { writes.push(String(chunk)); return true }) as any

  let out
  try {
    out = await hook(
      { hook_event_name: 'UserPromptSubmit', prompt: 'hello' } as any,
      undefined,
      { signal: new AbortController().signal },
    )
  } finally {
    process.stderr.write = orig
  }

  assert.deepEqual(out, {}, 'returns empty object so turn proceeds')
  assert.ok(writes.some(s => s.includes('[agentmem-recall]')), 'logged to stderr')
})

test('agentmemRecallHook drops hits with relevance_score: null (rerank failed)', async () => {
  // Regression for the rerank silent-degrade fix: when Gemini rate-limits, the
  // backend returns relevance_score=null instead of falling back to the raw
  // hybrid score. The hook MUST drop those hits, not inject them — falling back
  // to `score` was the original bug.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', content: 'kept-memory',    relevance_score: 0.9  }),
    makeHit({ id: '2', content: 'dropped-memory', relevance_score: null }),
  ]
  try {
    const hook = agentmemRecallHook({ apiKey: 'sk-fake', agentId: 'a', rerank: true })
    const out: any = await hook(
      { hook_event_name: 'UserPromptSubmit', prompt: 'q' } as any,
      undefined,
      { signal: new AbortController().signal },
    )
    const ctx = out?.hookSpecificOutput?.additionalContext as string
    assert.ok(ctx,                                'hook produced additionalContext')
    assert.ok( ctx.includes('kept-memory'),       'kept hit with relevance_score=0.9')
    assert.ok(!ctx.includes('dropped-memory'),    'dropped hit with relevance_score=null')
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})

test('agentmemRecallHook returns {} when every hit has relevance_score: null', async () => {
  // Edge of the same regression: if ALL hits failed rerank, the hook should
  // bail out (return {}) rather than inject an empty memory block with just a
  // preamble.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', relevance_score: null }),
    makeHit({ id: '2', relevance_score: null }),
  ]
  try {
    const hook = agentmemRecallHook({ apiKey: 'sk-fake', agentId: 'a', rerank: true })
    const out = await hook(
      { hook_event_name: 'UserPromptSubmit', prompt: 'q' } as any,
      undefined,
      { signal: new AbortController().signal },
    )
    assert.deepEqual(out, {}, 'no memories left after filtering → no injection')
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})
