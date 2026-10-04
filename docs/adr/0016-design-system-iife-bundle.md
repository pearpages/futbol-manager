# ADR 0016 — The design system ships one self-contained script for the artifact

**Status:** accepted · 2026-10-04

## Context

The Claude Design System artifact renders the components on a page that has no module
loader, no package resolution and no network. It needs the components as one classic script
and one stylesheet. The app needs none of that: it imports the package from source
(ADR 0015).

## Decision

1. `pnpm build` produces `dist/bundle.js`: a classic IIFE that assigns
   `window.FutbolDesignSystem`. It holds every export of `index.ts`, plus `React` and
   `createRoot` so a preview page can mount a component.
2. **React and ReactDOM 19 are inlined, not external.** The page has nothing to resolve
   them from. The ESM entry the app uses keeps them as peer dependencies (`^19`), so the game
   still runs one copy of React.
3. `dist/bundle.css` is the whole look in load order: tokens, reset, chrome, then each
   component's stylesheet.
4. `scripts/check-bundle.ts` runs after every bundle build and fails it unless the script:
   - assigns the global;
   - contains no `</script` (the artifact may inline it into a page);
   - has no `import`, `export` or `require`;
   - makes no network calls (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
     `sendBeacon`).

## Consequences

- The artifact works offline and can never pull code from anywhere.
- About 200 kB of script (64 kB gzipped), most of it React. Acceptable for a design tool;
  irrelevant to players, who never load it.
- `React` on a global is fine in the artifact's sandbox and would not be in the game, which
  is why the game never loads this file.
