# ADR 0014 — A design-system package, for the app and for Claude Design

**Status:** accepted · 2026-10-04
**Supersedes:** the wording of P11 (imports flow strictly `app → persistence → data → domain`)

## Context

The game's look lives inside `packages/app`: tokens in `styles/tokens.css`, the shared
primitives in `styles/chrome.css`, about twenty shared components in `screens/`, and art in
`public/`. One app uses it, so P5 has always said not to extract it.

The phone layouts are the next piece of work, and the owner wants them designed in Claude
Design on top of the game's real look rather than a generic one. A Claude "Design System"
artifact reads a design system as tokens, components in a standalone bundle, assets and a
README. That is a second consumer of the same tokens and components, which is the case P5
waits for.

## Decision

1. A new workspace package, `packages/design-system` (`@fm/design-system`), holds the tokens,
   the reset and chrome stylesheets, the shared components and React wrappers for the chrome
   primitives, the brand assets and a README. The app imports it; the artifact loads its
   bundle (ADR 0016).
2. It is a **side branch** of the dependency graph: `app → design-system`, and design-system
   imports no package of ours, no store, no state library and no storage. P11 becomes
   "imports flow `app → persistence → data → domain`, plus `app → design-system`". ESLint
   and `tests/boundaries.test.ts` enforce both directions.
3. It holds **no player-facing text**. Every string reaches a component as a prop, so P16 and
   the three dictionaries stay in the app.
4. P15 is unchanged: plain global `.css`, block-element class names, no Sass and no CSS
   Modules. Its pointer moves from `packages/app/src/styles/chrome.css` to the package's
   `chrome.css`.
5. Moving things changes no pixel. Every step is checked with before/after screenshots of
   the whole game at desktop and phone widths, compared byte for byte.

## Consequences

- The tokens and primitives get a home that is not "somewhere in the app", with a README
  that says how to use them.
- Claude Design mockups use the game's real tokens and components, so a chosen design
  translates back into code without re-interpretation.
- One more package to wire into lint, typecheck, tests and the build.
- Components that used to read the store or `useT` take props now, so their call sites in
  the app carry a thin adapter.
