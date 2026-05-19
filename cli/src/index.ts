import pc from 'picocolors'
import { init } from './commands/init.ts'
import type { Lang } from './detect.ts'

const VERSION = '0.1.0'

const HELP = `${pc.bold('agentmem')} — set up AgentMem in your project

${pc.bold('Usage')}
  npx @agentmem/cli ${pc.dim('[command] [options]')}
  agentmem init    ${pc.dim('(after install)')}

${pc.bold('Commands')}
  init             Install the SDK, add an env file, drop an example. ${pc.dim('(default)')}

${pc.bold('Options')}
  --lang <ts|python>   Override language detection
  --yes, -y            Skip confirmation prompt
  --skip-install       Don't run npm/pip — just write files
  --help, -h           Show this help
  --version, -v        Show version
`

interface Argv {
  command:     string
  lang?:       Lang
  yes:         boolean
  skipInstall: boolean
  help:        boolean
  version:     boolean
}

function parse(argv: string[]): Argv {
  const out: Argv = {
    command: 'init',
    yes:     false,
    skipInstall: false,
    help:    false,
    version: false,
  }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--help':    case '-h': out.help    = true; break
      case '--version': case '-v': out.version = true; break
      case '--yes':     case '-y': out.yes     = true; break
      case '--skip-install':       out.skipInstall = true; break
      case '--lang': {
        const v = argv[++i]
        if (v !== 'ts' && v !== 'python') {
          console.error(pc.red(`--lang must be 'ts' or 'python' (got ${v ?? 'nothing'})`))
          process.exit(2)
        }
        out.lang = v
        break
      }
      default:
        if (a.startsWith('-')) {
          console.error(pc.red(`unknown option: ${a}`))
          process.exit(2)
        }
        positional.push(a)
    }
  }
  if (positional[0]) out.command = positional[0]
  return out
}

async function main() {
  const argv = parse(process.argv.slice(2))

  if (argv.version) { console.log(VERSION); return }
  if (argv.help)    { console.log(HELP);    return }

  if (argv.command !== 'init') {
    console.error(pc.red(`unknown command: ${argv.command}`))
    console.error(HELP)
    process.exit(2)
  }

  const code = await init({
    cwd: process.cwd(),
    yes: argv.yes,
    lang: argv.lang,
    skipInstall: argv.skipInstall,
  })
  process.exit(code)
}

main().catch(err => {
  console.error(pc.red('fatal:'), err?.stack ?? err)
  process.exit(1)
})
