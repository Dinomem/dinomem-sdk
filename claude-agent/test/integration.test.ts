import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStore } from '@agentmem/sdk'
import {
  agentmemMcpServer,
  agentmemRecallHook,
  buildTools,
} from '../src/index.ts'

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
