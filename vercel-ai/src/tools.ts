import { tool } from 'ai'
import { z } from 'zod'
import {
  type DinoMemConfig,
  MemoryStore,
  DinoMemError,
  searchMemories,
} from './helpers.ts'

const scope = z.enum(['private', 'team', 'global'])
const role  = z.enum(['planner', 'executor', 'observer'])

function requireAgentId(c: { agentId?: string }, fallback?: string): string {
  const id = c.agentId ?? fallback
  if (!id) {
    throw new Error('[@dinomem/vercel-ai-provider] agentId is required (config or tool input).')
  }
  return id
}

/**
 * Vercel AI SDK tool for storing a fact in DinoMem.
 *
 * @example
 *   await generateText({
 *     model:  anthropic('claude-opus-4-7'),
 *     tools:  { memorize: dinomemMemorize({ apiKey, agentId: 'bot' }) },
 *     prompt: '...',
 *   })
 */
export function dinomemMemorize(config: DinoMemConfig) {
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })

  return tool({
    description:
      'Save a fact, preference, decision, or constraint to long-term memory so future runs can recall it. ' +
      'Use sparingly — only for durable facts, not chatty observations.',
    inputSchema: z.object({
      statement:  z.string().describe('The fact to remember, in self-contained prose.'),
      agentId:    z.string().optional().describe('Override the default agentId.'),
      workflowId: z.string().optional().describe('Group memories by workflow / session.'),
      scope:      scope.optional().describe('Visibility — private (default), team, or global.'),
      role:       role.optional().describe('Agent role for conflict policies.'),
    }),
    execute: async ({ statement, agentId, workflowId, scope, role }) => {
      try {
        const result = await mem.write({
          content:    statement,
          agentId:    requireAgentId({ agentId }, config.agentId),
          scope:      scope ?? config.scope,
          role:       role  ?? config.role,
          workflowId: workflowId ?? config.workflowId,
        })
        return result.duplicate
          ? `Memory already existed (id: ${result.writeId}).`
          : `Memory saved (id: ${result.writeId}).`
      } catch (err) {
        if (err instanceof DinoMemError) return `DinoMem error (${err.status}): ${err.message}`
        return `DinoMem error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}

/**
 * Vercel AI SDK tool for recalling memories relevant to a question. Returns a
 * prompt-prefixed string the model can splice into its reasoning.
 */
export function dinomemRecall(config: DinoMemConfig) {
  return tool({
    description:
      'Search long-term memory for facts relevant to the current question. ' +
      'Call this when you need context the conversation has not provided.',
    inputSchema: z.object({
      question:   z.string().describe('The natural-language query.'),
      agentId:    z.string().optional(),
      workflowId: z.string().optional(),
      topK:       z.number().int().min(1).max(50).optional().describe('Max hits (default 5).'),
      scope:      scope.optional(),
    }),
    execute: async ({ question, agentId, workflowId, topK, scope }) => {
      try {
        const hits = await searchMemories(question, {
          ...config,
          agentId:    agentId    ?? config.agentId,
          workflowId: workflowId ?? config.workflowId,
          topK:       topK       ?? config.topK,
          scope:      scope      ?? config.scope,
        })
        if (hits.length === 0) return 'No relevant memories found.'
        return hits.map(h => `- ${h.content}`).join('\n')
      } catch (err) {
        if (err instanceof DinoMemError) return `DinoMem error (${err.status}): ${err.message}`
        return `DinoMem error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
