import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * M0's exit criterion is "the boundary rule fails the build when `domain` imports
 * React". These tests assert the rule actually fires.
 *
 * ADR 0001 makes ESLint the readable half of boundary enforcement (pnpm's
 * node_modules layout is the other half). A rule that silently stops matching —
 * after a config refactor, a plugin bump, a renamed package — is worse than no
 * rule, because the invariant looks guarded while it isn't. So the config is
 * tested like any other code.
 */

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot })
})

/** Lints a source string *as if* it lived at the given path, so `files` matchers apply. */
async function lintAs(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'unknown'}: ${m.message}`)
}

describe('package boundary enforcement', () => {
  it('rejects React inside domain — the roadmap exit criterion', async () => {
    const messages = await lintAs(
      'packages/domain/src/probe.ts',
      `import { useState } from 'react'\nexport const probe = useState\n`,
    )
    expect(messages.join('\n')).toMatch(/no-restricted-imports/)
    expect(messages.join('\n')).toMatch(/Ground rule 1/)
  })

  it.each([
    ['domain', 'packages/domain/src/probe.ts', '@fm/persistence'],
    ['domain', 'packages/domain/src/probe.ts', '@fm/data'],
    ['data', 'packages/data/src/probe.ts', '@fm/persistence'],
    ['data', 'packages/data/src/probe.ts', '@fm/app'],
    ['persistence', 'packages/persistence/src/probe.ts', '@fm/app'],
    ['domain', 'packages/domain/src/probe.ts', '@fm/design-system'],
    ['data', 'packages/data/src/probe.ts', '@fm/design-system'],
    ['persistence', 'packages/persistence/src/probe.ts', '@fm/design-system'],
    ['design-system', 'packages/design-system/src/probe.ts', '@fm/domain'],
    ['design-system', 'packages/design-system/src/probe.tsx', '@fm/data'],
    ['design-system', 'packages/design-system/src/probe.tsx', '@fm/persistence'],
    ['design-system', 'packages/design-system/src/probe.tsx', '@fm/app'],
    ['design-system', 'packages/design-system/src/probe.tsx', 'zustand'],
  ])('rejects %s importing %s', async (_pkg, filePath, forbidden) => {
    const messages = await lintAs(filePath, `import x from '${forbidden}'\nexport default x\n`)
    expect(messages.join('\n')).toMatch(/no-restricted-imports/)
  })

  it.each([
    ['data', 'packages/data/src/probe.ts', '@fm/domain'],
    ['persistence', 'packages/persistence/src/probe.ts', '@fm/domain'],
    ['persistence', 'packages/persistence/src/probe.ts', '@fm/data'],
    ['app', 'packages/app/src/probe.ts', '@fm/persistence'],
    ['app', 'packages/app/src/probe.ts', '@fm/design-system'],
    ['design-system', 'packages/design-system/src/probe.tsx', 'react'],
  ])('allows %s importing %s', async (_pkg, filePath, allowed) => {
    const messages = await lintAs(filePath, `import x from '${allowed}'\nexport default x\n`)
    expect(messages.join('\n')).not.toMatch(/no-restricted-imports/)
  })
})

describe('determinism enforcement in domain', () => {
  it.each([
    ['Math.random()', 'export const x = Math.random()\n', /no-restricted-properties/],
    ['Date.now()', 'export const x = Date.now()\n', /no-restricted-properties/],
    ['new Date()', 'export const x = new Date()\n', /no-restricted-syntax/],
  ])('rejects %s', async (_label, code, rule) => {
    const messages = await lintAs('packages/domain/src/probe.ts', code)
    expect(messages.join('\n')).toMatch(rule)
  })

  it('permits Math.imul, which the PRNG needs', async () => {
    const messages = await lintAs(
      'packages/domain/src/probe.ts',
      'export const x = Math.imul(2, 3)\n',
    )
    expect(messages.join('\n')).not.toMatch(/no-restricted-properties/)
  })

  it('leaves the same non-determinism alone outside domain', async () => {
    // The bans are scoped. `app` reading the clock is normal.
    const messages = await lintAs('packages/app/src/probe.ts', 'export const x = Date.now()\n')
    expect(messages.join('\n')).not.toMatch(/no-restricted-properties/)
  })
})
