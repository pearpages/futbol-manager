# futbol-manager

A PC Fútbol 2001-style football management game. No real-time match engine — results are resolved statistically. Fictional clubs and players by default; dataset import is an opt-in layer.

**Read before working:** [`docs/roadmap.md`](docs/roadmap.md) for what to build and in what order, [`docs/stack.md`](docs/stack.md) for every tool and version, [`docs/attribute-model.md`](docs/attribute-model.md) for the player spec, [`docs/adr/`](docs/adr/) for settled decisions. Do not reopen an ADR's question without saying why the ADR is wrong.

## Ground rules

These are invariants. Do not violate one to get something working faster.

1. **`domain` imports nothing but the seeded PRNG.** No React, no `fetch`, no `Date.now()`, no `new Date()`, no `Math.random()`.
2. **Mutate state only through `reduce(state, command, rng)`.** The UI dispatches commands and renders from emitted events. It never mutates state directly.
3. **Every save carries `schemaVersion`.** Every schema change ships a migration and a round-trip test against the previous version's fixture save.
4. **Ticks are days, never weeks.**
5. **Do not generalise until a second case exists.** One hardcoded league until M7's second division and cup force the abstraction.
6. **Leave the game playable at the end of every milestone.** Boring is fine. Broken is not.

**The day clock is state.** `Season.currentDate` is advanced only by the tick and round-trips through every save, alongside the PRNG state. Never read the system clock anywhere in the codebase.

## Packages

```
packages/domain/        pure TS — entities, reducer, pipeline, resolvers
packages/data/          adapters: raw datasets → domain entities
packages/persistence/   save/load + migrations (IndexedDB, JSON export)
packages/app/           React + Vite
```

Imports flow strictly `app → persistence → data → domain`. Enforced twice: pnpm's strict `node_modules` blocks undeclared imports, and ESLint `no-restricted-imports` names the violation. Never add an import that reverses or short-circuits that direction.

pnpm workspaces, no Turborepo — see [ADR 0001](docs/adr/0001-workspace-tooling.md).

## Stack

Node 24.16.0, pnpm 11.15.0, TypeScript **6.0.3** (not 7 — see [ADR 0006](docs/adr/0006-typescript-6-not-7.md)), Vite 8, Vitest 4, React 19, Zustand 5, ESLint 10.

**[`docs/stack.md`](docs/stack.md) is the only place a version number is decided.** Pins are exact and a bump is a deliberate commit. Check that file before adding any dependency; check ADR 0006 before touching TypeScript.

`mise.toml` pins Node and pnpm. First-time setup: `mise trust && mise install && pnpm install`.

## Commands

```bash
pnpm test -- --run              # always --run; bare `pnpm test` starts watch mode and hangs
pnpm test -- --run <fileName>   # single test file
pnpm typecheck
pnpm lint
pnpm format
pnpm dev                        # app only
```

## Conventions

- **Styling:** plain `.css`, global, with block-element class names (`.squad-screen__row`). No CSS Modules, no Sass, no CSS-in-JS. Never inline styles, style objects, or a JSX `style` prop. Shared chrome lives in `packages/app/src/styles/`; reach for `chrome.css` before writing screen-specific CSS, and add a primitive there the _second_ time a screen needs it. See [`docs/stack.md`](docs/stack.md#styling--plain-css-global-block-element-class-names).
- **Randomness:** always through the injected `rng`, never a bare call. A function that needs randomness takes it as a parameter.
- **Determinism:** any headless run must be reproducible from `(seed, commands)`. If a test is flaky, something read the clock or the global RNG — find it, don't retry it.
- **Balance changes** must keep the N-season statistical harness green. The harness is the regression net for M2, M4 and M5; it exists from M1 onward.

## Session log

At the end of a working session, append a dated entry below: what was finished, what is pending, and anything the next session would otherwise have to rediscover.

### 2026-08-13 (a) — docs

**Done:** Roadmap refined and decisions locked. Wrote `docs/attribute-model.md` (eight attributes, position weights, age curve, the M3→M2 resolver contract, data-pipeline mapping skeleton), five ADRs, and this file. Pulled the N-season harness forward from M2 to M1. Recorded the day-clock-as-state consequence as an M1 constraint.

### 2026-08-13 (b) — stack + M0 ✅

**Done:** Wrote `docs/stack.md` (every tool pinned exactly). Reversed ADR 0001 from npm to **pnpm** — strict `node_modules` is a second boundary-enforcement layer, which matters for a dependency-free `domain`. Added ADR 0006 pinning TypeScript to 6.0.3.

M0 complete and its exit criterion met: four packages wired, `sfc32` in `packages/domain/src/rng.ts` with the serialise/deserialise test, ESLint boundary + determinism rules scoped to `domain`, and `tests/boundaries.test.ts` asserting those rules actually fire. `pnpm test -- --run` → 26 tests green across five Vitest projects. Typecheck, lint and format clean. CI workflow added (inert — no git remote yet).

**Two departures from plan, both recorded in `docs/stack.md`:** no `eslint-plugin-import-x` (its `no-restricted-paths` matches resolved paths, which under pnpm go through symlinks — built-in `no-restricted-imports` against `@fm/*` specifiers is exact and needs no resolver); and `eslint.config.js` rather than `.ts`, avoiding a `jiti` dependency.

**Pending:** **M1** — `Club`/`Competition`/`Fixture`/`Season` entities, round-robin generation for 20 clubs / 38 rounds, Spanish tiebreakers, coin-flip resolver, and the N-season statistical harness with loose bands.

**Open question carried forward:** `pace` has no direct FBref source stat; the mapping in `attribute-model.md` is a proxy. Resolve during M3's data work.

### 2026-08-13 (c) — styling convention + M0 closed

**Styling changed from CSS Modules to plain global CSS with block-element names**, before it could spread past one component. The roadmap's original "fun in CSS Modules" line was wrong for this project: ~40 screens are the same object with different columns sharing one chrome, so scoping guards a collision that shouldn't happen while making "every screen looks identical" harder. It also defeats the block-element naming convention, since the mechanism _is_ generated names. Plain CSS over Sass — nesting is native, custom properties beat Sass variables for tokens, and a compiler cuts against a codebase whose `domain` has zero dependencies. Reasoning in [`docs/stack.md`](docs/stack.md#styling--plain-css-global-block-element-class-names); no ADR, this is a convention.

`packages/app/src/styles/` now holds `tokens.css`, `reset.css` and `chrome.css`. **`chrome.css` is deliberately empty** — its primitives get derived at M3 from real screens, not guessed now (ground rule 5).

**Vite verified for the first time** — it had only ever been exercised through Vitest's transform, never its own. `pnpm build` emits a CSS asset (proof the stylesheet pipeline runs) and the dev server serves TSX with React Refresh, resolves `@fm/persistence` to raw workspace source, and ships class names as `app-shell__title` rather than a hash.

**M0 is closed with no asterisk.** 26 tests across five projects, typecheck/lint/format clean, build and dev server both working.

**Pending:** **M1** — `Club`/`Competition`/`Fixture`/`Season` entities, round-robin generation for 20 clubs / 38 rounds, Spanish tiebreakers, coin-flip resolver, and the N-season statistical harness with loose bands.
