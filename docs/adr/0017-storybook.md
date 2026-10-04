# ADR 0017 — Storybook for the screens

**Status:** accepted · 2026-10-04

## Context

The game is moving to phones. Every screen has to be looked at in several states and at
several widths, and reaching a state meant playing to it: the end of the season, a closed
window, a matchday morning. Screenshots taken by a throwaway script were the only way to
review a layout, and nobody but the agent could open them. The design system's
`preview.html` files show components, not screens, because the screens read the game's
store.

## Decision

1. Storybook 10 (`storybook`, `@storybook/react-vite`, `@storybook/react`, pinned in
   `docs/stack.md`) lives in `packages/app`, dev only, never deployed. `pnpm storybook`
   runs it.
2. A story renders the real `App`. Its scene (`src/stories/stage.ts`) starts a career from
   the store's fixed seed and plays it forward through the reducer, so a story shows real
   data and the same data every time. Saved careers in the browser are never restored into
   a story.
3. The toolbar switches width (phone 390, tablet 768, desktop 1280, ADR 0018) and language
   (ca, es, en).
4. `src/stories/stories.test.tsx` runs every story under Vitest, and CI builds Storybook,
   so a story that throws or a broken config fails the pipeline.
5. The design-system components keep their `preview.html` files for the Claude Design
   System artifact; they are not duplicated as stories.
6. pnpm refuses esbuild's install script (`allowBuilds` in `pnpm-workspace.yaml`); the
   binary arrives as a platform package without it.

## Consequences

- Any screen, in any state, at any width, is one click away for anyone reviewing a change.
- About a hundred dev-only packages join the lockfile. `pnpm audit` is clean at adoption.
- A scene that drifts from what the game does, for example a screen renamed, fails the
  story test rather than going stale.
