// Public surface
export {
  addMemories,
  retrieveMemories,
  searchMemories,
  promptToQuery,
  DEFAULT_PREFIX,
  MemoryStore,
  AgentMemError,
} from './helpers.ts'
export type { AgentMemConfig, MessageLike, MemoryHit, Scope, Role } from './helpers.ts'

export { createAgentMemMiddleware } from './middleware.ts'
export { agentmemMemorize, agentmemRecall } from './tools.ts'
