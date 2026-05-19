import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Lang = 'ts' | 'python'

export type PkgManager =
  | 'npm' | 'pnpm' | 'yarn' | 'bun'
  | 'pip' | 'uv'   | 'poetry'

export interface Detected {
  lang:    Lang | null
  pm:      PkgManager | null
  cwd:     string
  /** A short human-readable reason for the detection — used in the confirm step. */
  reason:  string
}

const has = (cwd: string, f: string) => existsSync(join(cwd, f))

export function detectLang(cwd: string): { lang: Lang | null; reason: string } {
  if (has(cwd, 'package.json'))     return { lang: 'ts',     reason: 'found package.json' }
  if (has(cwd, 'pyproject.toml'))   return { lang: 'python', reason: 'found pyproject.toml' }
  if (has(cwd, 'requirements.txt')) return { lang: 'python', reason: 'found requirements.txt' }
  if (has(cwd, 'setup.py'))         return { lang: 'python', reason: 'found setup.py' }
  return { lang: null, reason: 'no project manifest found' }
}

export function detectPm(cwd: string, lang: Lang): PkgManager {
  if (lang === 'ts') {
    if (has(cwd, 'bun.lockb'))         return 'bun'
    if (has(cwd, 'pnpm-lock.yaml'))    return 'pnpm'
    if (has(cwd, 'yarn.lock'))         return 'yarn'
    return 'npm'
  }
  // python
  if (has(cwd, 'uv.lock'))             return 'uv'
  if (has(cwd, 'poetry.lock'))         return 'poetry'
  if (has(cwd, 'pyproject.toml')) {
    try {
      const t = readFileSync(join(cwd, 'pyproject.toml'), 'utf8')
      if (/\[tool\.poetry\]/.test(t)) return 'poetry'
      if (/\[tool\.uv\]/.test(t))     return 'uv'
    } catch {}
  }
  return 'pip'
}

export function detect(cwd: string): Detected {
  const { lang, reason } = detectLang(cwd)
  if (!lang) return { lang: null, pm: null, cwd, reason }
  return { lang, pm: detectPm(cwd, lang), cwd, reason }
}
