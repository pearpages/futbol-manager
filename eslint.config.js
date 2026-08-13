import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// The dependency direction is app → persistence → data → domain.
// Under pnpm, node_modules layout already blocks undeclared imports; this is the
// second layer, and the one that produces a readable error. See ADR 0001.
//
// Matching is on the `@fm/*` specifier rather than on resolved paths: our packages
// have a naming convention, so specifier matching is exact and needs no resolver.
const forbidden = (packages, message) => ({
  patterns: [{ group: packages.flatMap((p) => [p, `${p}/*`]), message }],
})

const DIRECTION =
  'Dependency direction is app → persistence → data → domain. See docs/adr/0001-workspace-tooling.md.'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // ── domain ────────────────────────────────────────────────────────────────
  // Ground rule 1: no dependencies except the seeded PRNG, and no ambient
  // non-determinism. Four separate bans, because they fail in four ways.
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@fm/data',
                '@fm/data/*',
                '@fm/persistence',
                '@fm/persistence/*',
                '@fm/app',
                '@fm/app/*',
              ],
              message: `${DIRECTION} \`domain\` sits at the bottom and imports nothing.`,
            },
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'zustand', 'idb', 'node:*'],
              message:
                'Ground rule 1: `domain` has no dependencies except the seeded PRNG, which is written in-repo (ADR 0002).',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Ground rule 1: draw from the injected `rng` instead. An unseeded draw breaks replay and save/restore. See ADR 0002.',
        },
        {
          object: 'Date',
          property: 'now',
          message:
            'Ground rule 1: the day clock is state (`Season.currentDate`), advanced only by the tick. Nothing reads wall time.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'Ground rule 1: the day clock is state (`Season.currentDate`), advanced only by the tick. Nothing reads wall time.',
        },
      ],
    },
  },

  // ── data ──────────────────────────────────────────────────────────────────
  {
    files: ['packages/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbidden(
          ['@fm/persistence', '@fm/app'],
          `${DIRECTION} \`data\` may only reach \`domain\`.`,
        ),
      ],
    },
  },

  // ── persistence ───────────────────────────────────────────────────────────
  {
    files: ['packages/persistence/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbidden(['@fm/app'], `${DIRECTION} \`persistence\` may not reach \`app\`.`),
      ],
    },
  },
)
