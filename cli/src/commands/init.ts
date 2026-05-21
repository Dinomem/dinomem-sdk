import * as p from '@clack/prompts'
import pc from 'picocolors'
import { detect, detectPm, type Lang } from '../detect.ts'
import { installCommand, runInstall, previewInstall, SDK_PKG } from '../install.ts'
import { writeEnv, ensureGitignore, writeExample } from '../files.ts'

export interface InitOptions {
  cwd:       string
  yes:       boolean
  lang?:     Lang
  skipInstall: boolean
}

export async function init(opts: InitOptions): Promise<number> {
  p.intro(pc.bgCyan(pc.black(' AgentMem ')) + pc.cyan(' init '))

  const auto = detect(opts.cwd)
  let lang: Lang

  if (opts.lang) {
    lang = opts.lang
  } else if (auto.lang) {
    lang = auto.lang
    p.log.info(`Detected ${pc.bold(lang === 'ts' ? 'TypeScript / JavaScript' : 'Python')} project (${auto.reason}).`)
  } else {
    if (opts.yes) {
      p.log.error('No project manifest found. Pass --lang ts or --lang python in non-interactive mode.')
      return 1
    }
    const choice = await p.select({
      message: 'No project manifest found. Which language?',
      options: [
        { value: 'ts',     label: 'TypeScript / JavaScript' },
        { value: 'python', label: 'Python' },
      ],
    })
    if (p.isCancel(choice)) { p.cancel('Cancelled.'); return 1 }
    lang = choice as Lang
  }

  const pm = auto.pm ?? detectPm(opts.cwd, lang)
  const sdkPkg = SDK_PKG[lang]
  const envFile = lang === 'ts' ? '.env.local' : '.env'
  const exampleFile = lang === 'ts' ? 'agentmem-example.ts' : 'agentmem_example.py'

  p.note(
    [
      `${pc.dim('install')}      ${previewInstall(lang, pm)}`,
      `${pc.dim('env file')}     ${envFile}  ${pc.dim('(add AGENTMEM_API_KEY=)')}`,
      `${pc.dim('gitignore')}    + ${envFile}  ${pc.dim('(if missing)')}`,
      `${pc.dim('example')}      ${exampleFile}  ${pc.dim('(write + search demo)')}`,
    ].join('\n'),
    'Plan',
  )

  if (!opts.yes) {
    const ok = await p.confirm({ message: 'Proceed?', initialValue: true })
    if (p.isCancel(ok) || !ok) { p.cancel('Cancelled.'); return 1 }
  }

  if (!opts.skipInstall) {
    const s = p.spinner()
    s.start(`Installing ${sdkPkg}`)
    try {
      await runInstall(pm, opts.cwd)
      s.stop(`Installed ${sdkPkg}`)
    } catch (err: any) {
      s.stop(pc.red(`Install failed: ${err?.message ?? err}`))
      p.log.warn(`You can run it yourself: ${pc.bold(previewInstall(lang, pm))}`)
    }
  } else {
    p.log.info(`Skipped install. Run: ${pc.bold(previewInstall(lang, pm))}`)
  }

  const env = writeEnv(opts.cwd, lang)
  p.log.success(env.changed ? `Wrote ${env.file}` : `${env.file} already has ${pc.bold('AGENTMEM_API_KEY')} — left alone`)

  const gi = ensureGitignore(opts.cwd, lang)
  if (gi.changed) p.log.success(`Added ${envFile} to .gitignore`)

  const ex = writeExample(opts.cwd, lang)
  p.log.success(ex.changed ? `Wrote ${ex.file}` : `${ex.file} already exists — left alone`)

  p.note(
    [
      `${pc.bold('1.')} Get an API key:  ${pc.cyan('https://agentmem-dashboard.vercel.app')}`,
      `${pc.bold('2.')} Paste it into:   ${pc.bold(envFile)}`,
      `${pc.bold('3.')} Run the demo:    ${pc.bold(lang === 'ts' ? 'npx tsx ' + ex.file : 'python ' + ex.file)}`,
    ].join('\n'),
    'Next',
  )

  p.outro(pc.green('Done.'))
  return 0
}
