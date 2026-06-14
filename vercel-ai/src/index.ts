// Public surface
export {
  addMemories,
  retrieveMemories,
  searchMemories,
  promptToQuery,
  DEFAULT_PREFIX,
  MemoryStore,
  DinoMemError,
} from './helpers.ts'
export type { DinoMemConfig, MessageLike, MemoryHit, Scope, Role } from './helpers.ts'

export { createDinoMemMiddleware } from './middleware.ts'
export type { LanguageModel } from './middleware.ts'
export { dinomemMemorize, dinomemRecall } from './tools.ts'
