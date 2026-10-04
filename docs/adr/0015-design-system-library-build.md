# ADR 0015 — How the design-system package is built

**Status:** accepted · 2026-10-04

## Context

Every package here is consumed from source (ADR 0001): `exports` points at `src/index.ts`,
`tsconfig.base.json` sets `noEmit`, and only the app runs a build. The design-system has a
second consumer, the Claude Design System artifact, which cannot read TypeScript, resolve
workspace packages or load CSS imports. It needs built files.

## Decision

1. The app keeps consuming the package **from source**, like every other workspace package.
   `exports["."]` is `./src/index.ts`; `./tokens.css`, `./reset.css` and `./chrome.css` point
   at the stylesheets. Nothing in the app's build changes.
2. The built output exists only for the artifact, under `dist/`, and is made by
   `vite.lib.config.ts`: Vite 8's library mode, the same Vite the app uses. No second bundler.
3. Type declarations come from `vite-plugin-dts` with `bundleTypes`, rolled into one
   `dist/index.d.ts` through `@microsoft/api-extractor`. `tsconfig.build.json` overrides the
   base's `noEmit` with `emitDeclarationOnly`, which keeps `allowImportingTsExtensions`
   valid.
4. The root `pnpm build` becomes `pnpm -r build`, so pnpm runs it in dependency order:
   design-system first, then the app. CI's existing `pnpm build` step therefore builds and
   checks the bundle on every push.

## Consequences

- The app's build and dev server are unchanged.
- `dist/` is a build artefact and is gitignored, like the app's.
- Two new dev-only dependencies, pinned in `docs/stack.md`. api-extractor bundles its own
  TypeScript 5.9 and warns that the project uses 6.0. The declarations are plain enough
  that this does not matter today; revisit if a declaration ever comes out wrong.
