import { spawn } from 'node:child_process'
import type { Lang, PkgManager } from './detect.ts'

export const SDK_PKG = {
  ts:     '@dinomem/sdk',
  python: 'dinomem-py',
} as const

export function installCommand(pm: PkgManager): { cmd: string; args: string[] } {
  switch (pm) {
    case 'npm':    return { cmd: 'npm',    args: ['install', SDK_PKG.ts] }
    case 'pnpm':   return { cmd: 'pnpm',   args: ['add',     SDK_PKG.ts] }
    case 'yarn':   return { cmd: 'yarn',   args: ['add',     SDK_PKG.ts] }
    case 'bun':    return { cmd: 'bun',    args: ['add',     SDK_PKG.ts] }
    case 'pip':    return { cmd: 'pip',    args: ['install', SDK_PKG.python] }
    case 'uv':     return { cmd: 'uv',     args: ['add',     SDK_PKG.python] }
    case 'poetry': return { cmd: 'poetry', args: ['add',     SDK_PKG.python] }
  }
}

export function previewInstall(lang: Lang, pm: PkgManager): string {
  const { cmd, args } = installCommand(pm)
  return `${cmd} ${args.join(' ')}`
}

export function runInstall(pm: PkgManager, cwd: string): Promise<void> {
  const { cmd, args } = installCommand(pm)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}
