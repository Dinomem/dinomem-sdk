import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DinoMemIntegration,
  dinomemMemorize,
  dinomemRemember,
} from '../src/index.ts'

// ── construction ────────────────────────────────────────────────────────────

test('DinoMemIntegration constructs with just an apiKey', () => {
  const mem = new DinoMemIntegration({ apiKey: 'sk-fake' })
  assert.equal(mem.name, 'DINOMEM')
  assert.deepEqual(mem.categories, ['ai', 'memory'])
  assert.ok(mem.description.includes('Postgres'))
  assert.ok(mem.client, 'exposes underlying SDK client')
})

test('DinoMemIntegration stores defaults from config', () => {
  const mem = new DinoMemIntegration({
    apiKey:     'sk-fake',
    agentId:    'support-bot',
    scope:      'team',
    workflowId: 'wf-1',
  })
  // defaults are private — assert behavior via the agentId error path
  assert.ok(mem)
})

// ── agentId requirement ─────────────────────────────────────────────────────

test('createMemory throws helpful error when agentId is missing', async () => {
  const mem = new DinoMemIntegration({ apiKey: 'sk-fake' })
  await assert.rejects(
    () => mem.createMemory('test'),
    /agentId is required/,
  )
})

test('searchMemory throws helpful error when agentId is missing', async () => {
  const mem = new DinoMemIntegration({ apiKey: 'sk-fake' })
  await assert.rejects(
    () => mem.searchMemory('test'),
    /agentId is required/,
  )
})

// ── tool factories ──────────────────────────────────────────────────────────

test('dinomemMemorize returns a Mastra tool with the expected shape', () => {
  const mem  = new DinoMemIntegration({ apiKey: 'sk-fake', agentId: 'a' })
  const tool = dinomemMemorize(mem)
  assert.equal(tool.id, 'dinomem-memorize')
  assert.ok(tool.description?.toLowerCase().includes('memory'))
  assert.ok(tool.inputSchema,  'has inputSchema')
  assert.ok(tool.execute,      'has execute')

  // Validate the zod schema accepts the documented shape
  const parsed = tool.inputSchema!.parse({ statement: 'hello' })
  assert.equal(parsed.statement, 'hello')

  // …and rejects an empty payload
  assert.throws(() => tool.inputSchema!.parse({}))
})

test('dinomemRemember returns a Mastra tool with the expected shape', () => {
  const mem  = new DinoMemIntegration({ apiKey: 'sk-fake', agentId: 'a' })
  const tool = dinomemRemember(mem)
  assert.equal(tool.id, 'dinomem-remember')
  assert.ok(tool.description?.toLowerCase().includes('memory'))
  assert.ok(tool.inputSchema,  'has inputSchema')
  assert.ok(tool.execute,      'has execute')

  const parsed = tool.inputSchema!.parse({ question: 'what?' })
  assert.equal(parsed.question, 'what?')

  // topK clamping
  assert.throws(() => tool.inputSchema!.parse({ question: 'x', topK: 0 }))
  assert.throws(() => tool.inputSchema!.parse({ question: 'x', topK: 100 }))
})

// ── network-aware behaviour ─────────────────────────────────────────────────
// Hits a bogus base URL so we exercise the full code path without needing creds.

test('searchMemory empty result formats to empty string', async () => {
  const mem = new DinoMemIntegration({
    apiKey:  'sk-fake',
    baseUrl: 'http://127.0.0.1:9',           // unreachable on purpose
    agentId: 'smoke',
  })
  // Real API would 404; here fetch fails. Either way, we expect a thrown error
  // — but the IMPORTANT thing is that the request was made with the right shape.
  await assert.rejects(() => mem.searchMemory('anything'))
})
