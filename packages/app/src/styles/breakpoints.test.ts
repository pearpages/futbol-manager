import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_QUERY } from '../usePhone.ts'

/**
 * Every media query in the game's stylesheets is one of an agreed few (ADR 0018).
 *
 * The phone breakpoint is 40rem, everywhere, and `usePhone` asks for the same
 * one. The other widths are the screens' own steps between phone and desk, kept
 * as they were. A new value is a decision, not a typo: add it here and to the
 * ADR, or use one of these.
 */
const ALLOWED = new Set([
  '(width < 40rem)',
  '(width < 40rem), (pointer: coarse)',
  '(width < 48rem)',
  '(width < 52rem)',
  '(width < 60rem)',
  '(width < 64rem)',
  '(width < 68rem)',
  '(max-width: 40rem)',
  '(prefers-reduced-motion: reduce)',
  // Not a width: Windows High Contrast, where fills are dropped and a state
  // drawn only as a background has to be redrawn as a border or a system colour.
  '(forced-colors: active)',
])

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === 'node_modules' || entry.name === 'dist'
        ? []
        : cssFiles(join(dir, entry.name))
      : entry.name.endsWith('.css')
        ? [join(dir, entry.name)]
        : [],
  )
}

const root = resolve(process.cwd(), 'packages')
const files = [...cssFiles(join(root, 'app/src')), ...cssFiles(join(root, 'design-system/src'))]

describe('breakpoints', () => {
  it('asks for the same phone width in code as in CSS', () => {
    expect(PHONE_QUERY).toBe('(width < 40rem)')
  })

  it.each(files.map((f) => [f.slice(root.length + 1), f]))(
    '%s uses only agreed queries',
    (_n, file) => {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, query] of css.matchAll(/@media\s+([^{]+?)\s*\{/g)) {
        expect(ALLOWED, `${String(query)} in ${file}`).toContain(query)
      }
    },
  )
})
