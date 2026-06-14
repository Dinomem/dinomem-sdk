import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { MemoryStore } from '@dinomem/sdk'
import { tools, dispatch } from './tools.ts'

const VERSION = '0.1.0'

function readKey(): string {
  // back-compat: fall back to the old AGENTMEM_API_KEY env name for existing users
  const key = process.env.DINOMEM_API_KEY ?? process.env.AGENTMEM_API_KEY
  if (!key) {
    process.stderr.write(
      '[dinomem-mcp] DINOMEM_API_KEY is not set.\n' +
      '  Get a key at https://dinomem-dashboard.vercel.app and set it in your MCP client config, e.g.\n' +
      '    "env": { "DINOMEM_API_KEY": "sk-..." }\n'
    )
    process.exit(1)
  }
  return key
}

async function main() {
  const mem = new MemoryStore({
    apiKey:  readKey(),
    // back-compat: fall back to the old AGENTMEM_BASE_URL env name for existing users
    baseUrl: process.env.DINOMEM_BASE_URL ?? process.env.AGENTMEM_BASE_URL,
  })

  const server = new Server(
    { name: 'dinomem', version: VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name:        t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async req => {
    const result = await dispatch(mem, req.params.name, req.params.arguments)
    if (result.ok) {
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
    }
    return {
      isError: true,
      content: [{
        type: 'text',
        text: result.status
          ? `DinoMem error (${result.status}): ${result.error}`
          : `DinoMem error: ${result.error}`,
      }],
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Stay alive — stdio transport keeps the event loop busy.
  process.stderr.write(`[dinomem-mcp] v${VERSION} ready over stdio (${tools.length} tools)\n`)
}

main().catch(err => {
  process.stderr.write(`[dinomem-mcp] fatal: ${err?.stack ?? err}\n`)
  process.exit(1)
})
