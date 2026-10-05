# ADR 0023 — Checks in a real browser: layout, screenshots, one smoke test

**Status:** accepted · 2026-10-05

## Context

The suite runs on jsdom with no layout and no CSS, so clipping, overflow, contrast and
touch targets were invisible to every test. A run of fixes for phone and desk proved it:

- a cut-off points column;
- dialogs at 1.6:1 contrast;
- a calendar result hidden off the edge;
- names squeezed by their buttons.

Each was caught by a throwaway script in a session's scratch folder, and nothing kept them
fixed afterwards.

## Decision

1. **Playwright** (`@playwright/test`, pinned in `docs/stack.md`) runs against built
   output: the Storybook build and the game's `vite preview`. It has three projects:
   - **`layout`**: every story at 390, 768 and 1280, plus the dialogs the stories open,
     checked for sideways scroll, text below WCAG AA, text within 8px of its panel's
     edge, and, on a phone, controls under 24px. These are assertions, not pixels, so
     they need no reference images and hold across machines.
   - **`visual`**: screenshots of the design system's stories (foundations, primitives,
     components) at 390 and 1280, compared with committed references. The screens are
     left out: their game data moves with every balance change, so their images would
     churn.
   - **`smoke`**: the built game at phone and desk width, from a new career through a
     match, a named save and a reload to Continue.
2. **The reference screenshots are made on Linux, in CI**, in Playwright's own container
   image at the same version, because the game uses system fonts. A manual run of the
   workflow with `update_visual` makes them and uploads them as an artifact to commit.
   On any other platform the `visual` project skips.
3. **CI runs a `browser` job** in that image on every push and pull request, and a
   release's deploy waits for it as well as for `check`.

## Consequences

- Most of the layout bugs found by hand this month would now fail CI. The first run found
  two more on the desk: a status line 1px from its panel's edge, and squad columns hidden
  off the edge at tablet width.
- The pipeline grows by a few minutes, and the repository by the reference PNGs.
- A deliberate change to a component means making new references and reviewing the diff
  in the pull request.
