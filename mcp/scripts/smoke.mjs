// Smoke test: spawn the built MCP server, run the protocol handshake,
// list tools, and call one with a dummy key (expects an auth error).
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bin  = join(here, '..', 'dist', 'index.js')

function ndjsonClient(child) {
  let buf = ''
  const pending = new Map()
  let nextId = 1
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buf += chunk
    let i
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id)
        pending.delete(msg.id)
        resolve(msg)
      }
    }
  })
  return {
    request(method, params) {
      const id = nextId++
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      return new Promise(resolve => pending.set(id, { resolve }))
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
    },
  }
}

function withKey(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin], {
      env:    { ...process.env, ...env },
      stdio:  ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', c => { stderr += c })
    // 'close' fires after exit AND stdio drains — avoids racing stderr capture.
    child.on('close', (code) => resolve({ code, stderr }))
    child.on('error', reject)
    const t = setTimeout(() => { try { child.kill() } catch {} }, 3000)
    child.on('close', () => clearTimeout(t))
  })
}

async function main() {
  // 1. Missing key → expect non-zero exit with helpful stderr
  console.log('▸ test 1: missing AGENTMEM_API_KEY')
  const noKey = await withKey({ AGENTMEM_API_KEY: '' })
  console.log('  exit:', noKey.code)
  console.log('  stderr first line:', noKey.stderr.split('\n')[0])
  if (noKey.code !== 1 || !noKey.stderr.includes('AGENTMEM_API_KEY')) {
    console.error('  ✗ expected exit 1 and a helpful stderr line')
    process.exit(1)
  }
  console.log('  ✓ exits cleanly with the right message\n')

  // 2. Full handshake with a dummy key → list tools
  console.log('▸ test 2: initialize + tools/list')
  const child = spawn(process.execPath, [bin], {
    env:    { ...process.env, AGENTMEM_API_KEY: 'sk-smoke-test', AGENTMEM_BASE_URL: 'http://127.0.0.1:9' },
    stdio:  ['pipe', 'pipe', 'pipe'],
  })
  child.stderr.setEncoding('utf8')
  let stderr = ''
  child.stderr.on('data', c => { stderr += c })

  const rpc = ndjsonClient(child)
  const init = await rpc.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities:    {},
    clientInfo:      { name: 'smoke', version: '0.0.0' },
  })
  console.log('  initialize → server:', init.result?.serverInfo)
  rpc.notify('notifications/initialized', {})
  const list = await rpc.request('tools/list', {})
  const names = (list.result?.tools ?? []).map(t => t.name)
  console.log('  tools/list →', names.join(', '))

  const expected = [
    'memory_write','memory_search','memory_get','memory_delete',
    'memory_check_conflicts','scratch_set','scratch_get','workflow_summarize',
  ]
  for (const e of expected) {
    if (!names.includes(e)) { console.error('  ✗ missing tool:', e); child.kill(); process.exit(1) }
  }
  console.log('  ✓ all 8 tools advertised\n')

  // 3. Call a tool with bad creds → expect isError response
  console.log('▸ test 3: tools/call memory_write with bogus creds')
  const callResp = await rpc.request('tools/call', {
    name: 'memory_write',
    arguments: { content: 'smoke test', agentId: 'smoke' },
  })
  const isError = callResp.result?.isError === true
  const text    = callResp.result?.content?.[0]?.text ?? ''
  console.log('  isError:', isError, '/ text:', text.slice(0, 80))
  if (!isError) { console.error('  ✗ expected an error response'); child.kill(); process.exit(1) }
  console.log('  ✓ surfaced AgentMemError to the model cleanly\n')

  child.kill()
  console.log('all smoke tests passed.')
}

main().catch(err => { console.error(err); process.exit(1) })
