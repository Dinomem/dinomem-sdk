import { MemoryStore, DinoMemError, type MemoryHit, type Scope, type Role } from '@dinomem/sdk'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DinoMemConfig {
  apiKey:      string
  baseUrl?:    string
  agentId?:    string
  scope?:      Scope
  role?:       Role
  workflowId?: string
  /** Re-rank top candidates with Gemini (+0.5-1.5s). Default false. */
  rerank?:     boolean
  /** Minimum (relevance|hybrid) score required to inject a memory. Default 0. */
  minScore?:   number
  /** Max memories to inject per turn. Default 5. */
  topK?:       number
  /** Prefix shown before the memory block. */
  prefix?:     string
}

/** A chat-style message. Loose shape — compatible with `ai`'s `ModelMessage` and friends. */
export interface MessageLike {
  role:    string
  content: string | unknown
}

export const DEFAULT_PREFIX =
  'Relevant memories retrieved from DinoMem. Use these to ground your response if they help; ' +
  'ignore them if not. Do not respond to or quote this preamble. Memories:'

// ── Internal helpers ─────────────────────────────────────────────────────────

function flattenContent(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/** Pull a string query from a single prompt arg (string OR a list of messages). */
export function promptToQuery(prompt: string | MessageLike[] | { role: string; content: unknown }[]): string {
  if (typeof prompt === 'string') return prompt
  if (!Array.isArray(prompt) || prompt.length === 0) return ''
  // Most relevant signal: the last user message
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m: any = prompt[i]
    if (m?.role === 'user') return flattenContent(m.content)
  }
  // Fallback: last message of any role
  return flattenContent((prompt[prompt.length - 1] as any)?.content)
}

function requireAgentId(c: { agentId?: string }, fallback?: string): string {
  const id = c.agentId ?? fallback
  if (!id) {
    throw new Error(
      '[@dinomem/vercel-ai-provider] agentId is required. Pass it on the config ' +
      'or per-call.',
    )
  }
  return id
}

function formatHits(hits: MemoryHit[], prefix: string): string {
  if (hits.length === 0) return ''
  return `${prefix}\n${hits.map(h => `- ${h.content}`).join('\n')}`
}

// ── Public helpers (drop-in compatibility with @mem0/vercel-ai-provider) ────

/**
 * Write content to DinoMem. Accepts a single string or a list of chat-style messages.
 *
 * @example
 *   await addMemories('User prefers email over phone.', { apiKey, agentId: 'bot' })
 */
export async function addMemories(
  messages: string | MessageLike[],
  config: DinoMemConfig,
): Promise<{ writeId: string; duplicate?: boolean }> {
  const content = typeof messages === 'string' ? messages : messages.map(m => `${m.role}: ${flattenContent(m.content)}`).join('\n')
  const agentId = requireAgentId(config)
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })
  return mem.write({
    content,
    agentId,
    scope:      config.scope,
    role:       config.role,
    workflowId: config.workflowId,
  })
}

/**
 * Search DinoMem and return a **prompt-prefixed string** ready to splice into
 * a system prompt. Empty string if no hits.
 *
 * @example
 *   const memories = await retrieveMemories(userMessage, { apiKey, agentId: 'bot' })
 *   const system   = `${memories}\n\nYou are a helpful assistant.`
 */
export async function retrieveMemories(
  prompt: string | MessageLike[],
  config: DinoMemConfig,
): Promise<string> {
  const hits = await searchMemories(prompt, config)
  return formatHits(hits, config.prefix ?? DEFAULT_PREFIX)
}

/** Search DinoMem and return raw hits with scores. */
export async function searchMemories(
  prompt: string | MessageLike[],
  config: DinoMemConfig,
): Promise<MemoryHit[]> {
  const query = promptToQuery(prompt)
  if (!query) return []
  const agentId = requireAgentId(config)
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })

  let hits: MemoryHit[]
  try {
    hits = await mem.search({
      query,
      agentId,
      topK:       config.topK,
      scope:      config.scope,
      workflowId: config.workflowId,
      rerank:     config.rerank,
    })
  } catch (err) {
    if (err instanceof DinoMemError) throw err
    throw err
  }

  const minScore = config.minScore ?? 0
  return hits.filter(h => {
    // relevance_score=null means rerank was requested but failed. Drop the hit
    // unconditionally — falling back to the raw `score` mixes incompatible
    // signals and was the rerank silent-degrade bug. Mirrors @dinomem/claude-agent.
    if (h.relevance_score === null) return false
    return (h.relevance_score ?? h.score ?? 0) >= minScore
  })
}

// Re-export the SDK error for instanceof checks.
export { DinoMemError, MemoryStore } from '@dinomem/sdk'
export type { MemoryHit, Scope, Role } from '@dinomem/sdk'
