import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Lang } from './detect.ts'

const ENV_KEY = 'DINOMEM_API_KEY'

/** Returns the env filename we wrote to (or would write to) and whether we changed it. */
export function writeEnv(cwd: string, lang: Lang): { file: string; changed: boolean } {
  const file = lang === 'ts' ? '.env.local' : '.env'
  const path = join(cwd, file)
  const line = `${ENV_KEY}=`

  if (!existsSync(path)) {
    writeFileSync(path, `# DinoMem — get a key at https://dinomem-dashboard.vercel.app\n${line}\n`, 'utf8')
    return { file, changed: true }
  }
  const current = readFileSync(path, 'utf8')
  if (current.includes(ENV_KEY)) return { file, changed: false }
  const prefix = current.endsWith('\n') ? '' : '\n'
  appendFileSync(path, `${prefix}# DinoMem\n${line}\n`, 'utf8')
  return { file, changed: true }
}

export function ensureGitignore(cwd: string, lang: Lang): { changed: boolean } {
  const path = join(cwd, '.gitignore')
  const want = lang === 'ts' ? '.env.local' : '.env'
  if (!existsSync(path)) {
    writeFileSync(path, `${want}\n`, 'utf8')
    return { changed: true }
  }
  const current = readFileSync(path, 'utf8')
  const lines = current.split(/\r?\n/).map(l => l.trim())
  if (lines.includes(want) || lines.includes(`/${want}`) || lines.includes('.env*')) {
    return { changed: false }
  }
  const prefix = current.endsWith('\n') ? '' : '\n'
  appendFileSync(path, `${prefix}${want}\n`, 'utf8')
  return { changed: true }
}

const TS_EXAMPLE = `import { MemoryStore } from '@dinomem/sdk'

const mem = new MemoryStore({ apiKey: process.env.DINOMEM_API_KEY! })

async function main() {
  const { writeId } = await mem.write({
    content: 'DinoMem onboarding test — the user ran the init CLI.',
    agentId: 'cli-demo',
  })
  console.log('wrote:', writeId)

  const hits = await mem.search({
    query:   'what did the user do?',
    agentId: 'cli-demo',
    topK:    3,
  })
  for (const h of hits) console.log(h.score.toFixed(3), h.content)
}

main().catch(err => { console.error(err); process.exit(1) })
`

const PY_EXAMPLE = `import os
from dinomem_py import MemoryStore

mem = MemoryStore(api_key=os.environ["DINOMEM_API_KEY"])

result = mem.write(
    content="DinoMem onboarding test — the user ran the init CLI.",
    agent_id="cli-demo",
)
print("wrote:", result["writeId"])

hits = mem.search(query="what did the user do?", agent_id="cli-demo", top_k=3)
for h in hits:
    print(f"{h.score:.3f}  {h.content}")
`

export function writeExample(cwd: string, lang: Lang): { file: string; changed: boolean } {
  const file = lang === 'ts' ? 'dinomem-example.ts' : 'dinomem_example.py'
  const path = join(cwd, file)
  if (existsSync(path)) return { file, changed: false }
  writeFileSync(path, lang === 'ts' ? TS_EXAMPLE : PY_EXAMPLE, 'utf8')
  return { file, changed: true }
}
