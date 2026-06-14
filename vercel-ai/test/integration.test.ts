import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateObject, wrapLanguageModel } from 'ai'
import { z } from 'zod'
import { MemoryStore, type MemoryHit } from '@dinomem/sdk'
import {
  createDinoMemMiddleware,
  dinomemMemorize,
  dinomemRecall,
  promptToQuery,
  retrieveMemories,
  searchMemories,
  addMemories,
  DEFAULT_PREFIX,
} from '../src/index.ts'

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

test('createDinoMemMiddleware returns a v3 LanguageModelMiddleware', () => {
  const mw = createDinoMemMiddleware({ apiKey: 'sk-fake', agentId: 'a' })
  assert.equal(mw.specificationVersion, 'v3')
  assert.equal(typeof mw.transformParams, 'function')
})

test('middleware leaves params unchanged when search throws', async () => {
  const mw = createDinoMemMiddleware({
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
  assert.ok(writes.some(s => s.includes('[dinomem-middleware]')))
})

// ── tools ───────────────────────────────────────────────────────────────────

test('dinomemMemorize tool has the expected shape', () => {
  const t = dinomemMemorize({ apiKey: 'sk-fake', agentId: 'a' })
  assert.ok(t.description?.includes('memory'))
  assert.ok(t.inputSchema)
  assert.ok(typeof (t as any).execute === 'function')
})

test('dinomemRecall tool has the expected shape', () => {
  const t = dinomemRecall({ apiKey: 'sk-fake', agentId: 'a' })
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

// ── relevance_score: null regression ────────────────────────────────────────

test('searchMemories drops hits with relevance_score: null (default minScore)', async () => {
  // Regression for the rerank silent-degrade fix: relevance_score=null means
  // rerank was requested but failed. Substituting the raw `score` (different
  // range/semantics) was the original bug — these hits must be dropped, not
  // injected, even when minScore=0 (the default). Mirrors @dinomem/claude-agent.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', content: 'kept',    relevance_score: 0.9  }),
    makeHit({ id: '2', content: 'dropped', relevance_score: null }),
  ]
  try {
    const hits = await searchMemories('q', {
      apiKey:  'sk-fake',
      agentId: 'a',
      rerank:  true,
      // no minScore → default 0; null hits must still be dropped
    })
    assert.equal(hits.length, 1,   'only the valid-score hit survives')
    assert.equal(hits[0].id, '1',  'kept the hit with relevance_score=0.9')
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})

// ── generateObject parity ───────────────────────────────────────────────────

test('createDinoMemMiddleware handles generateObject-style structured-output params', async () => {
  // Unit-level check: when called with a `generate`-type params object that
  // includes a JSON `responseFormat` (the shape generateObject produces), the
  // middleware injects memory into the prompt and preserves the responseFormat.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', content: 'user prefers terse answers' }),
  ]
  try {
    const mw = createDinoMemMiddleware({ apiKey: 'sk-fake', agentId: 'a' })
    const params = {
      prompt: [{ role: 'user', content: 'summarize this' } as any],
      responseFormat: {
        type:   'json' as const,
        schema: { type: 'object', properties: { summary: { type: 'string' } } },
      },
    } as any

    const out = await mw.transformParams!({
      type:  'generate',
      params,
      model: {} as any,
    })

    const newPrompt = out.prompt as any[]
    assert.equal(newPrompt.length, 2,            'memory system message prepended')
    assert.equal(newPrompt[0].role, 'system')
    assert.ok(String(newPrompt[0].content).includes('user prefers terse answers'))
    assert.equal((out as any).responseFormat?.type, 'json', 'responseFormat preserved')
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})

test('generateObject flows through the middleware end-to-end', async () => {
  // Integration check: wrap a stub LanguageModelV3 with the middleware and
  // call `generateObject` from `ai`. The stub captures the prompt it received
  // — if the middleware fired, the stub will see the memory system message.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', content: 'the user prefers terse answers' }),
  ]

  let capturedPrompt: any = null
  const stub = {
    specificationVersion: 'v3' as const,
    provider:             'stub',
    modelId:              'stub-1',
    supportedUrls:        {},
    async doGenerate(options: any) {
      capturedPrompt = options.prompt
      return {
        content:      [{ type: 'text', text: '{"summary":"ok"}' }],
        finishReason: 'stop' as const,
        usage:        { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings:     [],
      }
    },
    async doStream() { throw new Error('not used by generateObject') },
  }

  try {
    const wrapped = wrapLanguageModel({
      model:      stub as any,
      middleware: createDinoMemMiddleware({ apiKey: 'sk-fake', agentId: 'a' }),
    })

    const { object } = await generateObject({
      model:  wrapped,
      schema: z.object({ summary: z.string() }),
      prompt: 'summarize this',
    })

    assert.deepEqual(object, { summary: 'ok' })
    assert.ok(Array.isArray(capturedPrompt), 'stub received a prompt array')
    const systemMsg = capturedPrompt.find((m: any) => m.role === 'system')
    assert.ok(systemMsg, 'memory system message reached the model')
    assert.ok(
      String(flatten(systemMsg.content)).includes('terse answers'),
      'system message contains the recalled memory text',
    )
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})

function flatten(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) return c.map((p: any) => p?.text ?? '').join('')
  return ''
}

test('retrieveMemories does not include null-relevance hits in injected text', async () => {
  // End-to-end check for the same regression on the prompt-prefixed surface,
  // at the default minScore=0.
  const origSearch = MemoryStore.prototype.search
  MemoryStore.prototype.search = async (): Promise<MemoryHit[]> => [
    makeHit({ id: '1', content: 'kept-content',    relevance_score: 0.9  }),
    makeHit({ id: '2', content: 'dropped-content', relevance_score: null }),
  ]
  try {
    const text = await retrieveMemories('q', {
      apiKey:  'sk-fake',
      agentId: 'a',
      rerank:  true,
    })
    assert.ok( text.includes('kept-content'),    'kept hit with valid relevance_score')
    assert.ok(!text.includes('dropped-content'), 'dropped hit with relevance_score=null')
  } finally {
    MemoryStore.prototype.search = origSearch
  }
})
