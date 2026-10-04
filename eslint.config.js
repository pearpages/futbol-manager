import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// The dependency direction is app → persistence → data → domain, with
// design-system as a side branch: app → design-system, which imports no @fm
// package at all (ADR 0014).
// Under pnpm, node_modules layout already blocks undeclared imports; this is the
// second layer, and the one that produces a readable error. See ADR 0001.
//
// Matching is on the `@fm/*` specifier rather than on resolved paths: our packages
// have a naming convention, so specifier matching is exact and needs no resolver.
const forbidden = (packages, message) => ({
  patterns: [{ group: packages.flatMap((p) => [p, `${p}/*`]), message }],
})

const DIRECTION =
  'Dependency direction is app → persistence → data → domain, plus app → design-system. See docs/adr/0001-workspace-tooling.md and 0014.'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/storybook-static/**'],
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
                '@fm/design-system',
                '@fm/design-system/*',
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
          ['@fm/persistence', '@fm/app', '@fm/design-system'],
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
        forbidden(
          ['@fm/app', '@fm/design-system'],
          `${DIRECTION} \`persistence\` may not reach \`app\` or \`design-system\`.`,
        ),
      ],
    },
  },

  // ── design-system ─────────────────────────────────────────────────────────
  // A leaf that the app and the Claude Design System artifact both consume. It
  // knows nothing about the game: no package of ours, no store, no state
  // library, no storage. Text arrives as props, so translation stays in the app.
  {
    files: ['packages/design-system/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@fm/domain',
                '@fm/domain/*',
                '@fm/data',
                '@fm/data/*',
                '@fm/persistence',
                '@fm/persistence/*',
                '@fm/app',
                '@fm/app/*',
              ],
              message: `${DIRECTION} \`design-system\` imports no package of ours.`,
            },
            {
              group: ['zustand', 'idb'],
              message:
                '`design-system` holds no state and touches no storage. Pass values in as props.',
            },
          ],
        },
      ],
    },
  },
)
