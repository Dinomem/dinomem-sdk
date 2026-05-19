import type { LanguageModelV3Middleware } from '@ai-sdk/provider'
import { AgentMemError } from '@agentmem/sdk'
import {
  type AgentMemConfig,
  DEFAULT_PREFIX,
  searchMemories,
  promptToQuery,
} from './helpers.ts'

/**
 * Build a Vercel AI SDK middleware that, on every model call, searches AgentMem
 * with the user's latest message and prepends matching memories to the system
 * prompt.
 *
 * @example
 *   import { wrapLanguageModel } from 'ai'
 *   import { anthropic } from '@ai-sdk/anthropic'
 *   import { createAgentMemMiddleware } from '@agentmem/vercel-ai-provider'
 *
 *   const model = wrapLanguageModel({
 *     model:      anthropic('claude-opus-4-7'),
 *     middleware: createAgentMemMiddleware({ apiKey, agentId: 'bot' }),
 *   })
 *
 *   const { text } = await generateText({ model, prompt: '...' })
 */
export function createAgentMemMiddleware(config: AgentMemConfig): LanguageModelV3Middleware {
  const prefix = config.prefix ?? DEFAULT_PREFIX

  return {
    specificationVersion: 'v3',

    async transformParams({ params }) {
      // params.prompt is LanguageModelV3Prompt — an array of messages
      const query = promptToQuery(params.prompt as any)
      if (!query) return params

      let hits
      try {
        hits = await searchMemories(query, config)
      } catch (err) {
        const msg = err instanceof AgentMemError
          ? `[agentmem-middleware] search failed (${err.status}): ${err.message}`
          : `[agentmem-middleware] search failed: ${err instanceof Error ? err.message : String(err)}`
        process.stderr.write(msg + '\n')
        return params
      }

      if (hits.length === 0) return params

      const memoryText = `${prefix}\n${hits.map(h => `- ${h.content}`).join('\n')}`

      // Inject as a system message at the start of the prompt array.
      const memoryMessage = {
        role:    'system' as const,
        content: memoryText,
      }

      return {
        ...params,
        prompt: [memoryMessage, ...(params.prompt as any[])] as typeof params.prompt,
      }
    },
  }
}
