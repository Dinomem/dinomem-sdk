import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import { MemoryStore } from '@dinomem/sdk'
import { buildTools } from './tools.ts'

export interface DinoMemServerConfig {
  apiKey:   string
  baseUrl?: string
  /** Override the in-process MCP server name. Default: 'dinomem'. */
  name?:    string
  /** Override the version reported to the agent. Default: package version. */
  version?: string
}

/**
 * Build an in-process MCP server exposing the 8 DinoMem tools, ready to drop
 * into `query({ options: { mcpServers: { dinomem: dinomemMcpServer(config) } } })`.
 *
 * This is the in-process equivalent of `npx -y @dinomem/mcp` — same tools,
 * same descriptions, no separate process or stdio transport. Use this when the
 * agent runs in your Node code.
 */
export function dinomemMcpServer(config: DinoMemServerConfig): McpSdkServerConfigWithInstance {
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })
  return createSdkMcpServer({
    name:    config.name    ?? 'dinomem',
    version: config.version ?? '0.1.0',
    tools:   buildTools(mem),
  })
}

export { dinomemRecallHook } from './recall-hook.ts'
export type { RecallHookConfig } from './recall-hook.ts'
export { buildTools } from './tools.ts'

// Re-exports for convenience
export { MemoryStore, DinoMemError } from '@dinomem/sdk'
export type { Scope, Role, MemoryHit } from '@dinomem/sdk'
