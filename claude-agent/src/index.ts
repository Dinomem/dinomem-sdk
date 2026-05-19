import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import { MemoryStore } from '@agentmem/sdk'
import { buildTools } from './tools.ts'

export interface AgentMemServerConfig {
  apiKey:   string
  baseUrl?: string
  /** Override the in-process MCP server name. Default: 'agentmem'. */
  name?:    string
  /** Override the version reported to the agent. Default: package version. */
  version?: string
}

/**
 * Build an in-process MCP server exposing the 8 AgentMem tools, ready to drop
 * into `query({ options: { mcpServers: { agentmem: agentmemMcpServer(config) } } })`.
 *
 * This is the in-process equivalent of `npx -y @agentmem/mcp` — same tools,
 * same descriptions, no separate process or stdio transport. Use this when the
 * agent runs in your Node code.
 */
export function agentmemMcpServer(config: AgentMemServerConfig): McpSdkServerConfigWithInstance {
  const mem = new MemoryStore({ apiKey: config.apiKey, baseUrl: config.baseUrl })
  return createSdkMcpServer({
    name:    config.name    ?? 'agentmem',
    version: config.version ?? '0.1.0',
    tools:   buildTools(mem),
  })
}

export { agentmemRecallHook } from './recall-hook.ts'
export type { RecallHookConfig } from './recall-hook.ts'
export { buildTools } from './tools.ts'

// Re-exports for convenience
export { MemoryStore, AgentMemError } from '@agentmem/sdk'
export type { Scope, Role, MemoryHit } from '@agentmem/sdk'
