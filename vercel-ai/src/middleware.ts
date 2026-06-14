import type { LanguageModelV3Middleware } from '@ai-sdk/provider'
import { DinoMemError } from '@dinomem/sdk'
import {
  type DinoMemConfig,
  DEFAULT_PREFIX,
  searchMemories,
  promptToQuery,
} from './helpers.ts'

/**
 * The model-object type accepted by `ai`'s `wrapLanguageModel`.
 *
 * `ai` exports a `LanguageModel` alias too, but it's a *union* —
 * `string | LanguageModelV3 | LanguageModelV2` — designed for high-level
 * helpers like `generateText` that accept a model id directly. Passing that
 * union type to `wrapLanguageModel` is a type error because `wrapLanguageModel`
 * requires the object form only.
 *
 * Import THIS `LanguageModel` instead when you need a typed variable that
 * round-trips through `wrapLanguageModel`:
 *
 * @example
 *   import { wrapLanguageModel } from 'ai'
 *   import { openai } from '@ai-sdk/openai'
 *   import { createDinoMemMiddleware, type LanguageModel } from '@dinomem/vercel-ai-provider'
 *
 *   const baseModel: LanguageModel = openai('gpt-4o-mini')
 *   const wrapped = wrapLanguageModel({
 *     model:      baseModel,
 *     middleware: createDinoMemMiddleware({ apiKey, agentId: 'bot' }),
 *   })
 */
export type LanguageModel = Parameters<typeof import('ai').wrapLanguageModel>[0]['model']

/**
 * Build a Vercel AI SDK middleware that, on every model call, searches DinoMem
 * with the user's latest message and prepends matching memories to the system
 * prompt.
 *
 * @example
 *   import { wrapLanguageModel } from 'ai'
 *   import { anthropic } from '@ai-sdk/anthropic'
 *   import { createDinoMemMiddleware } from '@dinomem/vercel-ai-provider'
 *
 *   const model = wrapLanguageModel({
 *     model:      anthropic('claude-opus-4-7'),
 *     middleware: createDinoMemMiddleware({ apiKey, agentId: 'bot' }),
 *   })
 *
 *   const { text } = await generateText({ model, prompt: '...' })
 */
export function createDinoMemMiddleware(config: DinoMemConfig): LanguageModelV3Middleware {
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
        const msg = err instanceof DinoMemError
          ? `[dinomem-middleware] search failed (${err.status}): ${err.message}`
          : `[dinomem-middleware] search failed: ${err instanceof Error ? err.message : String(err)}`
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
