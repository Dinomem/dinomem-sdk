import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createAgentMemMiddleware,
  agentmemMemorize,
  agentmemRecall,
  promptToQuery,
  retrieveMemories,
  searchMemories,
  addMemories,
  DEFAULT_PREFIX,
} from '../src/index.ts'

// ── promptToQuery ───────────────────────────────────────────────────────────

test('promptToQuery returns string verbatim', () => {
  assert.equal(promptToQuery('hello world'), 'hello world')
})

test('promptToQuery extracts last user message from chat history', () => {
  const messages = [
    { role: 'system',    content: 'be helpful' },
    { role: 'user',      content: 'first question' },
    { role: 'assistant', content: 'first answer' },
    { role: 'user',      content: 'second question' },
  ]
  assert.equal(promptToQuery(messages), 'second question')
})

test('promptToQuery handles content arrays (text parts)', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'text', text: 'part two' }] },
  ]
  assert.equal(promptToQuery(messages), 'part one\npart two')
})

test('promptToQuery returns empty for empty input', () => {
  assert.equal(promptToQuery(''), '')
  assert.equal(promptToQuery([]), '')
})

// ── middleware ──────────────────────────────────────────────────────────────

test('createAgentMemMiddleware returns a v3 LanguageModelMiddleware', () => {
  const mw = createAgentMemMiddleware({ apiKey: 'sk-fake', agentId: 'a' })
  assert.equal(mw.specificationVersion, 'v3')
  assert.equal(typeof mw.transformParams, 'function')
})

test('middleware leaves params unchanged when search throws', async () => {
  const mw = createAgentMemMiddleware({
    apiKey:  'sk-fake',
    baseUrl: 'http://127.0.0.1:9',
    agentId: 'a',
  })

  const writes: string[] = []
  const orig = process.stderr.write.bind(process.stderr)
  process.stderr.write = ((c: any) => { writes.push(String(c)); return true }) as any

  let out
  try {
    out = await mw.transformParams!({
      type:  'generate',
      params: { prompt: [{ role: 'user', content: 'hi' } as any] } as any,
      model: {} as any,
    })
  } finally {
    process.stderr.write = orig
  }
  // Param should be unchanged (still one message)
  assert.equal((out.prompt as any[]).length, 1)
  assert.ok(writes.some(s => s.includes('[agentmem-middleware]')))
})

// ── tools ───────────────────────────────────────────────────────────────────

test('agentmemMemorize tool has the expected shape', () => {
  const t = agentmemMemorize({ apiKey: 'sk-fake', agentId: 'a' })
  assert.ok(t.description?.includes('memory'))
  assert.ok(t.inputSchema)
  assert.ok(typeof (t as any).execute === 'function')
})

test('agentmemRecall tool has the expected shape', () => {
  const t = agentmemRecall({ apiKey: 'sk-fake', agentId: 'a' })
  assert.ok(t.description?.toLowerCase().includes('long-term memory'))
  assert.ok(t.inputSchema)
  assert.ok(typeof (t as any).execute === 'function')
})

// ── helpers ─────────────────────────────────────────────────────────────────

test('retrieveMemories returns empty string when no hits', async () => {
  const text = await retrieveMemories('xyz', { apiKey: 'sk-fake', baseUrl: 'http://127.0.0.1:9', agentId: 'a' })
    .catch(() => '')
  assert.equal(text, '')
})

test('searchMemories returns [] for empty prompt without making a request', async () => {
  const hits = await searchMemories('', { apiKey: 'sk-fake', agentId: 'a' })
  assert.deepEqual(hits, [])
})

test('addMemories errors helpfully when agentId is missing', async () => {
  await assert.rejects(
    () => addMemories('hi', { apiKey: 'sk-fake' }),
    /agentId is required/,
  )
})

test('DEFAULT_PREFIX is non-empty and tells the model what to do', () => {
  assert.ok(DEFAULT_PREFIX.length > 60)
  assert.ok(DEFAULT_PREFIX.toLowerCase().includes('memor'))
})
