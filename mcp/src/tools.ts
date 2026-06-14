import type { MemoryStore } from '@dinomem/sdk'
import { DinoMemError } from '@dinomem/sdk'

/**
 * MCP tool descriptors. The `description` and parameter docs are read by the
 * model (e.g. Claude) at tool-selection time, so they must be precise.
 */

export interface ToolDescriptor {
  name:        string
  description: string
  inputSchema: Record<string, unknown>
  handler:     (mem: MemoryStore, args: any) => Promise<unknown>
}

const scopeEnum = { type: 'string', enum: ['private', 'team', 'global'] }
const roleEnum  = { type: 'string', enum: ['planner', 'executor', 'observer'] }

export const tools: ToolDescriptor[] = [
  {
    name:        'memory_write',
    description:
      'Persist a fact to long-term memory. Use this when the user states a preference, a decision, a constraint, or any durable fact that should outlive the current conversation. Returns the new memory id.',
    inputSchema: {
      type:     'object',
      required: ['content', 'agentId'],
      properties: {
        content:    { type: 'string',  description: 'The fact to store, in plain prose. Keep it self-contained — it will be retrieved out of context later.' },
        agentId:    { type: 'string',  description: 'Identifier for the agent writing this memory.' },
        scope:      { ...scopeEnum,    description: 'Visibility: private (only this agent), team (this workflow), or global (whole org). Default: private.' },
        role:       { ...roleEnum,     description: 'Agent role — used by conflict policies. Optional.' },
        workflowId: { type: 'string',  description: 'Group memories by workflow / session. Optional.' },
        expiresAt:  { type: 'string',  description: 'ISO 8601 expiry. Optional.' },
      },
    },
    handler: (mem, a) => mem.write({
      content:    a.content,
      agentId:    a.agentId,
      scope:      a.scope,
      role:       a.role,
      workflowId: a.workflowId,
      expiresAt:  a.expiresAt,
    }),
  },

  {
    name:        'memory_search',
    description:
      'Hybrid retrieval (semantic + keyword + entity graph) over the agent\'s memories. Use this when you need context the conversation has not provided — past decisions, user preferences, prior work. Returns ranked hits with content and score.',
    inputSchema: {
      type:     'object',
      required: ['query', 'agentId'],
      properties: {
        query:      { type: 'string',  description: 'Natural-language query.' },
        agentId:    { type: 'string',  description: 'Identifier for the agent searching.' },
        topK:       { type: 'integer', description: 'How many hits to return (default 5).', minimum: 1, maximum: 50 },
        scope:      { ...scopeEnum,    description: 'Limit to a visibility scope. Optional.' },
        workflowId: { type: 'string',  description: 'Limit to a workflow. Optional.' },
        atTime:     { type: 'string',  description: 'ISO 8601 timestamp — return memories that were valid at this point in time. Optional.' },
        rerank:     { type: 'boolean', description: 'Re-score top candidates with Gemini for higher precision. Adds ~500-1500ms. Default false.' },
      },
    },
    handler: (mem, a) => mem.search({
      query:      a.query,
      agentId:    a.agentId,
      topK:       a.topK,
      scope:      a.scope,
      workflowId: a.workflowId,
      atTime:     a.atTime,
      rerank:     a.rerank,
    }),
  },

  {
    name:        'memory_get',
    description: 'Fetch one memory by its id (returned by memory_write or memory_search). Use this when you need full metadata for a specific memory.',
    inputSchema: {
      type:     'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Memory uuid.' } },
    },
    handler: (mem, a) => mem.get(a.id),
  },

  {
    name:        'memory_delete',
    description: 'Soft-delete a memory. Use this when the user explicitly revokes a fact, or when you detect the memory is no longer accurate and want to retract it. Reversible only via support.',
    inputSchema: {
      type:     'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Memory uuid to delete.' } },
    },
    handler: async (mem, a) => { await mem.delete(a.id); return { deleted: a.id } },
  },

  {
    name:        'memory_check_conflicts',
    description:
      'Before writing a fact that might contradict existing memory, check for conflicts. Returns conflicting memories with severity. Call this on high-stakes writes (deadlines, decisions, policies) — not on every chatty observation.',
    inputSchema: {
      type:     'object',
      required: ['content', 'agentId'],
      properties: {
        content:    { type: 'string', description: 'The proposed fact to check.' },
        agentId:    { type: 'string', description: 'Identifier for the agent that would write this.' },
        workflowId: { type: 'string', description: 'Limit to a workflow. Optional.' },
        scope:      { ...scopeEnum,   description: 'Limit to a scope. Optional.' },
      },
    },
    handler: (mem, a) => mem.checkConflicts({
      content:    a.content,
      agentId:    a.agentId,
      workflowId: a.workflowId,
      scope:      a.scope,
    }),
  },

  {
    name:        'scratch_set',
    description:
      'Store a transient working-memory value, scoped to a workflow, with an optional TTL. Use for intermediate state that should NOT become a long-term memory — e.g. a parsed JSON blob you want a later step to read.',
    inputSchema: {
      type:     'object',
      required: ['workflowId', 'key', 'value'],
      properties: {
        workflowId: { type: 'string',  description: 'Workflow that owns this key.' },
        key:        { type: 'string',  description: 'Key name. Reuse to overwrite.' },
        value:      { type: 'string',  description: 'Value to store (string — JSON-encode structured data yourself).' },
        ttlSecs:    { type: 'integer', description: 'TTL in seconds. Omit for default retention.', minimum: 1 },
      },
    },
    handler: async (mem, a) => {
      await mem.scratchSet({ workflowId: a.workflowId, key: a.key, value: a.value, ttlSecs: a.ttlSecs })
      return { ok: true }
    },
  },

  {
    name:        'scratch_get',
    description: 'Read a transient working-memory value previously set with scratch_set. Returns null if the key is missing or expired.',
    inputSchema: {
      type:     'object',
      required: ['workflowId', 'key'],
      properties: {
        workflowId: { type: 'string', description: 'Workflow that owns the key.' },
        key:        { type: 'string', description: 'Key name to read.' },
      },
    },
    handler: async (mem, a) => ({ value: await mem.scratchGet(a.workflowId, a.key) }),
  },

  {
    name:        'workflow_summarize',
    description:
      'Generate a Markdown brief summarising every memory in a workflow. Use this when a long workflow has accumulated more memories than you want to scroll through — e.g. at the start of a new session that\'s resuming prior work.',
    inputSchema: {
      type:     'object',
      required: ['workflowId', 'agentId'],
      properties: {
        workflowId: { type: 'string', description: 'Workflow to summarise.' },
        agentId:    { type: 'string', description: 'Identifier for the agent requesting the summary.' },
      },
    },
    handler: async (mem, a) => ({ summary: await mem.summarize(a.workflowId, a.agentId) }),
  },
]

/** Dispatch by name. Throws on unknown tool. */
export async function dispatch(
  mem:  MemoryStore,
  name: string,
  args: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
  const tool = tools.find(t => t.name === name)
  if (!tool) return { ok: false, error: `unknown tool: ${name}` }

  try {
    const data = await tool.handler(mem, args ?? {})
    return { ok: true, data }
  } catch (err) {
    if (err instanceof DinoMemError) {
      return { ok: false, error: err.message, status: err.status }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
