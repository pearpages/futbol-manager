# ADR 0021 — Storybook covers the design system, in levels

**Status:** accepted · 2026-10-05 · supersedes point 5 of ADR 0017

## Context

ADR 0017 put the game's screens in Storybook and left the design system's 42 components
to their `preview.html` files, which exist for the Claude Design System artifact and which
nobody opened. So a component could not be seen on its own, in its states, at phone
width, and nothing but a screen test noticed one breaking. The contrast pass made the cost
visible: most of its defects were components drawn on the wrong surface, which a component
shown on its own surface would have exposed.

## Decision

1. **One Storybook, in four levels, bottom up:**
   - **Foundations:** colour, type, space and radius, icons. They are read from
     `tokens.json` and the icon sets, so they cannot drift. The colour page shows each
     ink's WCAG contrast on the surfaces it is allowed on.
   - **Primitives:** the `chrome.css` wrappers.
   - **Components:** composed parts with behaviour.
   - **Screens:** the game, as ADR 0017 set up.
2. **Stories live beside their components**, as `packages/design-system/src/**/*.stories.tsx`,
   and import only from the design system (P11). The app's `.storybook/main.ts` globs both
   packages; `storySort` fixes the order.
3. **Each story shows its component on the surface it is drawn for** (`stories/Stage.tsx`):
   readouts on the screen material, hardware on the panel, dialogs on the page.
4. **Foundation colours come from generated CSS.** `tokens:build` also writes
   `src/foundations/swatches.css` (one class per token), checked by `tokens.test.ts`, so
   no story needs an inline style (P15).
5. **`src/stories.test.tsx` renders every design-system story** under Vitest. CI's
   Storybook build already covers the new glob.
6. **`preview.html` stays** for the artifact, which cannot run Storybook.

## Consequences

- Every token, primitive and component can be reviewed alone, at any width, before it reaches
  a screen.
- The design-system package gains `storybook` and `@storybook/react` as dev dependencies,
  at the versions already pinned for the app; the lockfile gains nothing new.
- Two descriptions of each component, its story and its preview, can drift. Rendering the
  previews from the stories is a follow-up.
