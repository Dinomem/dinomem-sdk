import { z } from 'zod'
import { MemoryStore, DinoMemError } from '@dinomem/sdk'
import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'

const scope = z.enum(['private', 'team', 'global'])
const role  = z.enum(['planner', 'executor', 'observer'])

// The SDK uses CallToolResult from @modelcontextprotocol/sdk, which has an
// index signature. We mirror it loosely so our handlers slot in cleanly.
interface ToolResult {
  [k: string]:  unknown
  content:      Array<{ type: 'text'; text: string }>
  isError?:     boolean
}

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(err: unknown): ToolResult {
  if (err instanceof DinoMemError) {
    return { isError: true, content: [{ type: 'text', text: `DinoMem error (${err.status}): ${err.message}` }] }
  }
  return {
    isError: true,
    content: [{ type: 'text', text: `DinoMem error: ${err instanceof Error ? err.message : String(err)}` }],
  }
}

/**
 * Build a tool with proper zod schema inference. The SDK's generic erases on
 * heterogenous arrays, so we infer per-tool here and cast once at the array
 * boundary.
 */
function tool<S extends z.ZodRawShape>(def: {
  name:        string
  description: string
  inputSchema: S
  handler:     (args: z.infer<z.ZodObject<S>>) => Promise<ToolResult>
}): SdkMcpToolDefinition<any> {
  return {
    name:        def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    handler:     def.handler as unknown as SdkMcpToolDefinition<any>['handler'],
  }
}

/**
 * Build the 8 DinoMem tools as `SdkMcpToolDefinition`s. Descriptions are
 * tuned for model-side selection — keep them precise.
 */
export function buildTools(mem: MemoryStore): SdkMcpToolDefinition<any>[] {
  return [
    tool({
      name:        'memory_write',
      description:
        'Persist a fact to long-term memory. Use when the user states a preference, decision, or constraint ' +
        'that should outlive the current conversation. Returns the new memory id.',
      inputSchema: {
        content:    z.string().describe('The fact to store, in self-contained prose.'),
        agentId:    z.string().describe('Identifier for the agent writing this memory.'),
        scope:      scope.optional().describe('Visibility — private (default), team, or global.'),
        role:       role.optional().describe('Agent role for conflict policies. Optional.'),
        workflowId: z.string().optional().describe('Group memories by workflow / session. Optional.'),
        expiresAt:  z.string().optional().describe('ISO 8601 expiry. Optional.'),
      },
      handler: async (a) => {
        try { return ok(await mem.write(a)) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'memory_search',
      description:
        'Hybrid retrieval (semantic + keyword + entity graph) over the agent\'s memories. Use when you need ' +
        'context the conversation has not provided — past decisions, user preferences, prior work.',
      inputSchema: {
        query:      z.string().describe('Natural-language query.'),
        agentId:    z.string().describe('Identifier for the agent searching.'),
        topK:       z.number().int().min(1).max(50).optional().describe('Max hits (default 5).'),
        scope:      scope.optional(),
        workflowId: z.string().optional(),
        atTime:     z.string().optional().describe('ISO 8601 timestamp — temporal retrieval. Optional.'),
        rerank:     z.boolean().optional().describe('Re-score top candidates with Gemini. Adds 0.5-1.5s. Default false.'),
      },
      handler: async (a) => {
        try { return ok(await mem.search(a)) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'memory_get',
      description: 'Fetch one memory by its id. Use when you need full metadata for a specific memory.',
      inputSchema: { id: z.string().describe('Memory uuid.') },
      handler: async ({ id }) => {
        try { return ok(await mem.get(id)) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'memory_delete',
      description:
        'Soft-delete a memory. Use when the user explicitly revokes a fact, or when you detect a memory ' +
        'is no longer accurate. Reversible only via support.',
      inputSchema: { id: z.string().describe('Memory uuid to delete.') },
      handler: async ({ id }) => {
        try { await mem.delete(id); return ok({ deleted: id }) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'memory_check_conflicts',
      description:
        'Before writing a fact that might contradict existing memory, check for conflicts. Returns ' +
        'conflicting memories with severity. Call on high-stakes writes (deadlines, decisions, policies).',
      inputSchema: {
        content:    z.string(),
        agentId:    z.string(),
        workflowId: z.string().optional(),
        scope:      scope.optional(),
      },
      handler: async (a) => {
        try { return ok(await mem.checkConflicts(a)) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'scratch_set',
      description:
        'Store a transient working-memory value, scoped to a workflow, with an optional TTL. Use for ' +
        'intermediate state that should NOT become a long-term memory.',
      inputSchema: {
        workflowId: z.string(),
        key:        z.string(),
        value:      z.string(),
        ttlSecs:    z.number().int().min(1).optional(),
      },
      handler: async (a) => {
        try { await mem.scratchSet(a); return ok({ ok: true }) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'scratch_get',
      description: 'Read a transient working-memory value previously set with scratch_set. Null if missing or expired.',
      inputSchema: {
        workflowId: z.string(),
        key:        z.string(),
      },
      handler: async ({ workflowId, key }) => {
        try { return ok({ value: await mem.scratchGet(workflowId, key) }) } catch (e) { return fail(e) }
      },
    }),

    tool({
      name:        'workflow_summarize',
      description:
        'Generate a Markdown brief summarising every memory in a workflow. Useful when resuming a long ' +
        'session.',
      inputSchema: {
        workflowId: z.string(),
        agentId:    z.string(),
      },
      handler: async ({ workflowId, agentId }) => {
        try { return ok({ summary: await mem.summarize(workflowId, agentId) }) } catch (e) { return fail(e) }
      },
    }),
  ]
}
