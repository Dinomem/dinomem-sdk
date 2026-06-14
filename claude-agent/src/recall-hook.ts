import type { HookCallback, HookJSONOutput } from '@anthropic-ai/claude-agent-sdk'
import { MemoryStore, DinoMemError, type Scope } from '@dinomem/sdk'

export interface RecallHookConfig {
  apiKey:    string
  baseUrl?:  string
  /** Identifier the recall is scoped to. Required. */
  agentId:   string
  /** Limit recall to a workflow. Optional. */
  workflowId?: string
  /** Limit recall to a scope. Optional. */
  scope?:    Scope
  /** Number of memories to surface per prompt. Default 5. */
  topK?:     number
  /** Re-rank with Gemini for higher precision (+0.5-1.5s). Default false. */
  rerank?:   boolean
  /** Minimum score to inject a memory (0..1). Default 0 (anything that matches). */
  minScore?: number
  /** Prefix shown before the memory block in the injected context. */
  prefix?:   string
}

const DEFAULT_PREFIX =
  'Relevant memories retrieved from DinoMem. Use these to ground your response if relevant; ' +
  'ignore them if not. Do not respond to or quote this preamble. Memories:'

/**
 * Build a `UserPromptSubmit` hook that searches DinoMem for the user's prompt
 * and injects the top hits as `additionalContext` for the turn.
 *
 * @example
 *   import { query } from '@anthropic-ai/claude-agent-sdk'
 *   const recall = dinomemRecallHook({ apiKey, agentId: 'support-bot' })
 *
 *   query({
 *     prompt,
 *     options: {
 *       hooks: { UserPromptSubmit: [{ hooks: [recall] }] },
 *     },
 *   })
 */
export function dinomemRecallHook(config: RecallHookConfig): HookCallback {
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })
  const prefix   = config.prefix   ?? DEFAULT_PREFIX
  const minScore = config.minScore ?? 0

  return async (input): Promise<HookJSONOutput> => {
    if (input.hook_event_name !== 'UserPromptSubmit') return {}

    let hits
    try {
      hits = await mem.search({
        query:      input.prompt,
        agentId:    config.agentId,
        topK:       config.topK ?? 5,
        scope:      config.scope,
        workflowId: config.workflowId,
        rerank:     config.rerank,
      })
    } catch (err) {
      // Memory failure must not break the turn. Log to stderr; return passively.
      const msg = err instanceof DinoMemError
        ? `[dinomem-recall] search failed (${err.status}): ${err.message}`
        : `[dinomem-recall] search failed: ${err instanceof Error ? err.message : String(err)}`
      process.stderr.write(msg + '\n')
      return {}
    }

    const filtered = hits.filter(h => {
      // relevance_score=null means rerank was requested but failed. Drop the
      // hit rather than fall back to the raw `score` (different semantics).
      if (h.relevance_score === null) return false
      return (h.relevance_score ?? h.score ?? 0) >= minScore
    })
    if (filtered.length === 0) return {}

    const body = filtered.map(h => `- ${h.content}`).join('\n')
    return {
      hookSpecificOutput: {
        hookEventName:     'UserPromptSubmit',
        additionalContext: `${prefix}\n${body}`,
      },
    }
  }
}
