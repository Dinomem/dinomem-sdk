import { Integration } from '@mastra/core/integration'
import { createTool } from '@mastra/core/tools'
import { MemoryStore, type MemoryHit, type Scope, type Role } from '@agentmem/sdk'
import { z } from 'zod'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentMemConfig {
  /** AgentMem API key. Get one at https://agentmem-dashboard.vercel.app */
  apiKey:      string
  /** Override the API base URL (self-hosters). */
  baseUrl?:    string
  /** Default agent id to use when none is passed per-call. */
  agentId?:    string
  /** Default visibility scope (private | team | global). */
  scope?:      Scope
  /** Default agent role (planner | executor | observer). */
  role?:       Role
  /** Default workflow id to group memories. */
  workflowId?: string
}

export interface WriteOptions {
  agentId?:    string
  scope?:      Scope
  role?:       Role
  workflowId?: string
  expiresAt?:  string
}

export interface SearchOptions {
  agentId?:    string
  topK?:       number
  scope?:      Scope
  workflowId?: string
  atTime?:     string
  rerank?:     boolean
}

/** A chat-style message. Matches the shape Mastra and Vercel AI SDK both use. */
export interface Message {
  role:    'system' | 'user' | 'assistant' | 'tool'
  content: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MEMORY_PROMPT_PREFIX =
  'Relevant memories retrieved from AgentMem. Use these to ground your response if they are relevant; ' +
  'ignore them if they are not. Do not respond to or quote this preamble. Memories:\n\n'

function messagesToContent(messages: Message[] | string): string {
  if (typeof messages === 'string') return messages
  return messages.map(m => `${m.role}: ${m.content}`).join('\n')
}

function formatHits(hits: MemoryHit[]): string {
  if (hits.length === 0) return ''
  const body = hits.map(h => `- ${h.content}`).join('\n')
  return `${MEMORY_PROMPT_PREFIX}${body}`
}

function requireAgentId(opts: { agentId?: string }, fallback?: string): string {
  const id = opts.agentId ?? fallback
  if (!id) {
    throw new Error(
      '[@agentmem/mastra] agentId is required. Pass it on the integration config ' +
      'or per-call (constructor `agentId` or tool input `agentId`).',
    )
  }
  return id
}

// ── Integration class ───────────────────────────────────────────────────────

export class AgentMemIntegration extends Integration {
  readonly name        = 'AGENTMEM'
  readonly logoUrl     = ''
  readonly categories  = ['ai', 'memory']
  readonly description =
    'AgentMem — Postgres-native memory layer for AI agents. Hybrid retrieval (semantic + keyword + graph), ' +
    'conflict detection, multi-agent scoping.'

  /** The underlying SDK client; expose for advanced cases. */
  readonly client: MemoryStore

  private readonly defaults: Omit<AgentMemConfig, 'apiKey' | 'baseUrl'>

  constructor(config: AgentMemConfig) {
    super()
    this.client = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })
    this.defaults = {
      agentId:    config.agentId,
      scope:      config.scope,
      role:       config.role,
      workflowId: config.workflowId,
    }
  }

  /**
   * Persist content to long-term memory. Returns a short confirmation string
   * suitable for passing back to an LLM as a tool result.
   */
  async createMemory(messages: Message[] | string, options: WriteOptions = {}): Promise<string> {
    const content = messagesToContent(messages)
    const agentId = requireAgentId(options, this.defaults.agentId)
    const { writeId, duplicate } = await this.client.write({
      content,
      agentId,
      scope:      options.scope      ?? this.defaults.scope,
      role:       options.role       ?? this.defaults.role,
      workflowId: options.workflowId ?? this.defaults.workflowId,
      expiresAt:  options.expiresAt,
    })
    const verb = duplicate ? 'Memory already existed' : 'Memory saved'
    return `${verb} (id: ${writeId}). Content: ${content}`
  }

  /**
   * Retrieve memories relevant to `query`. Returns a prompt-ready string
   * (prefixed with usage instructions for the model) — empty string if nothing found.
   */
  async searchMemory(query: string, options: SearchOptions = {}): Promise<string> {
    const agentId = requireAgentId(options, this.defaults.agentId)
    const hits = await this.client.search({
      query,
      agentId,
      topK:       options.topK,
      scope:      options.scope      ?? this.defaults.scope,
      workflowId: options.workflowId ?? this.defaults.workflowId,
      atTime:     options.atTime,
      rerank:     options.rerank,
    })
    return formatHits(hits)
  }

  /**
   * Same as `searchMemory` but returns raw hits with scores instead of a
   * formatted string. Useful when you want to render UI or apply your own
   * threshold.
   */
  async searchMemoryRaw(query: string, options: SearchOptions = {}): Promise<MemoryHit[]> {
    const agentId = requireAgentId(options, this.defaults.agentId)
    return this.client.search({
      query,
      agentId,
      topK:       options.topK,
      scope:      options.scope      ?? this.defaults.scope,
      workflowId: options.workflowId ?? this.defaults.workflowId,
      atTime:     options.atTime,
      rerank:     options.rerank,
    })
  }
}

// ── Pre-built tools ─────────────────────────────────────────────────────────

const scopeSchema = z.enum(['private', 'team', 'global'])
const roleSchema  = z.enum(['planner', 'executor', 'observer'])

/**
 * Tool that stores a fact in AgentMem. Drop into a Mastra agent's `tools` map.
 *
 * @example
 *   const agentmem = new AgentMemIntegration({ apiKey, agentId: 'support-bot' })
 *   const agent = new Agent({
 *     tools: { memorize: agentmemMemorize(agentmem) },
 *   })
 */
export function agentmemMemorize(integration: AgentMemIntegration, defaults: WriteOptions = {}) {
  return createTool({
    id:          'agentmem-memorize',
    description:
      'Save a fact, preference, decision, or constraint to long-term memory so future runs can recall it. ' +
      'Use sparingly — only for durable facts, not chatty observations.',
    inputSchema: z.object({
      statement:  z.string().describe('The fact to remember, in self-contained prose.'),
      agentId:    z.string().optional().describe('Override the default agentId.'),
      workflowId: z.string().optional().describe('Group this memory under a workflow.'),
      scope:      scopeSchema.optional().describe('Visibility: private | team | global.'),
      role:       roleSchema.optional().describe('Agent role for conflict policies.'),
    }),
    execute: async ({ context }) =>
      integration.createMemory(context.statement, {
        agentId:    context.agentId    ?? defaults.agentId,
        workflowId: context.workflowId ?? defaults.workflowId,
        scope:      context.scope      ?? defaults.scope,
        role:       context.role       ?? defaults.role,
      }),
  })
}

/**
 * Tool that recalls AgentMem memories relevant to a question. Returns a
 * prompt-prefixed string the model can drop directly into its reasoning.
 */
export function agentmemRemember(integration: AgentMemIntegration, defaults: SearchOptions = {}) {
  return createTool({
    id:          'agentmem-remember',
    description:
      'Search long-term memory for facts relevant to the current question. ' +
      'Call this when you need context the conversation has not provided — past decisions, user preferences, prior work.',
    inputSchema: z.object({
      question:   z.string().describe('The natural-language query.'),
      agentId:    z.string().optional().describe('Override the default agentId.'),
      workflowId: z.string().optional().describe('Limit to a workflow.'),
      topK:       z.number().int().min(1).max(50).optional().describe('Max hits (default 5).'),
      scope:      scopeSchema.optional().describe('Limit to a scope.'),
    }),
    execute: async ({ context }) =>
      integration.searchMemory(context.question, {
        agentId:    context.agentId    ?? defaults.agentId,
        workflowId: context.workflowId ?? defaults.workflowId,
        topK:       context.topK       ?? defaults.topK,
        scope:      context.scope      ?? defaults.scope,
      }),
  })
}

// ── Re-exports for convenience ──────────────────────────────────────────────

export { MemoryStore, AgentMemError } from '@agentmem/sdk'
export type { Scope, Role, MemoryHit } from '@agentmem/sdk'
