# Principles

Every change to this repository, whether code, docs, tests or process, complies with these
rules. When a change would break one, stop and ask the user instead of working around it.
Changing a principle is itself a decision: it needs the user's agreement and an ADR
([decisions.md](decisions.md)). How things are built is in
[architecture.md](architecture.md); security rules in [security.md](security.md).

Each rule has a **Why**, and a **Check** where something enforces it (a test, lint rule,
CI step, hook).

## Ground rules

These are invariants. Do not break one to get something working faster.

**P1. `domain` imports nothing but the seeded PRNG.** No React, no `fetch`, no `Date.now()`,
no `new Date()`, no `Math.random()`.
_Why:_ the model has to be pure to be deterministic and testable headless.
_Check:_ ESLint `no-restricted-imports` / `no-restricted-syntax` scoped to `domain`;
`tests/boundaries.test.ts` asserts those rules really fire; `@fm/domain` declares no dependencies.

**P2. State changes only through `reduce(state, command, rng)`.** The UI dispatches commands
and renders from the events they emit. It never mutates state directly. New commands go in
`reduce.ts`, and validation (a legal XI, an affordable bid) lives in the reducer, not in screens.
_Why:_ the statistical harness only covers what it drives, so it has to go through the same
door as the UI. A screen forgets a check; the reducer can't.
_Check:_ review; the harness and `simulateCareer` dispatch through `reduce`.

**P3. Every save carries `schemaVersion`.** Every schema change ships a migration plus a
round-trip test against the previous version's committed fixture. A migration describes what
its version meant when it shipped, never a live constant.
_Why:_ careers last months across many builds. [ADR 0005](docs/adr/0005-persistence.md).
_Check:_ `packages/persistence/src/migrations.test.ts` against `fixtures/v*.json`.

**P4. Ticks are days, never weeks. The day clock is state.** `Season.currentDate` is a
`DayNumber`, advanced only by the tick, and round-trips through every save alongside the PRNG
state. No code anywhere reads the system clock. Calendar arithmetic belongs only in
`packages/domain/src/time.ts`.
_Why:_ determinism, and M6's day pipeline hangs off `AdvanceDay`.
_Check:_ P1's lint rules; `time.test.ts` round-trips every day from 1900 to 2300.

**P5. Do not generalise until a second case exists.** That covers one hardcoded league until
M7, and a `chrome.css` primitive the _second_ time a screen needs it, not the first.
_Why:_ an abstraction guessed from one case is usually the wrong one.
_Check:_ review.

**P6. Leave the game playable at the end of every milestone.** Boring is fine. Broken is not.
_Why:_ a milestone that leaves the game unplayable has not finished.
_Check:_ CI on `main` builds and deploys the playable app.

## Determinism and balance

**P7. Randomness only through the injected `rng`.** A function that needs randomness takes
it as a parameter. Randomness that must not shift the main stream is derived from a hash
(`hashSeed`) or a separate stream instead of being drawn.
_Why:_ one stream is shared by everything, so one extra `rng.next()` inside `AdvanceDay`
moves every calibrated band in the project.
_Check:_ any headless run reproduces from `(seed, commands)`; `pnpm season` is byte-identical.

**P8. Extend a calibrated model only in ways that are inert when the new feature is
unused.** Examples: tempo vanishes at balanced tactics, the bid subsystem draws no rng, and the
reluctance premium is exactly 1 for every surplus player.
_Why:_ that is what lets a feature ship without re-tuning everything already measured.
_Check:_ `pnpm season` byte-identical before and after; every existing band unchanged.

**P9. When a harness band fails, fix the model, never the band.** The structural invariants
are never loosened: goals conserved, points arithmetic, every win somebody's loss, and the
per-club ledger identity ([ADR 0009](docs/adr/0009-the-ledger-identity.md)). A flaky test
means something read the clock or the global RNG: find it, don't retry it.
_Why:_ the N-season harness is the regression net for M2, M4 and M5.
_Check:_ the `*.harness.test.ts` suites.

**P10. No lever whose best setting is an end stop.** A slider, price or formation whose best
answer is its maximum or minimum is an exploit. Measure it across clubs before shipping.
_Why:_ it happened with the tactics slider (M3a), the ticket price (M5b) and stadium expansion.
_Check:_ sweep tests that assert the optimum is interior (e.g. ticket price, formation × slider).

## Code conventions

**P11. Imports flow strictly `app → persistence → data → domain`, plus `app →
design-system`.** Never add an import that reverses or skips a step in that direction.
`design-system` is a side branch: it imports no package of ours.
_Why:_ it keeps `domain` dependency-free and the layers testable alone, and keeps the design
system free of the game so a second consumer can load it.
[ADR 0001](docs/adr/0001-workspace-tooling.md), [ADR 0014](docs/adr/0014-design-system-package.md).
_Check:_ pnpm's strict `node_modules` plus ESLint `no-restricted-imports` on `@fm/*`.

**P12. Relative imports carry `.ts` / `.tsx` extensions, never `.js`.**
_Why:_ that is what lets `node scripts/*.ts` run package sources with no extra tooling.
_Check:_ `allowImportingTsExtensions`; typecheck.

**P13. A date is a `DayNumber`, never a `Date`.** Add days with `addDays`, compare with `<`,
and convert for display with `toCivil` / `formatDate`.
_Check:_ P1's lint rules forbid `new Date()` in `domain`.

**P14. Versions are decided only in [`docs/stack.md`](docs/stack.md).** Pins are exact, and
a bump is a deliberate commit. TypeScript stays on 6.x
([ADR 0006](docs/adr/0006-typescript-6-not-7.md)).
_Check:_ `pnpm install --frozen-lockfile` in CI.

## UI conventions

**P15. Styling is plain global `.css` with block-element class names**
(`.squad-screen__row`). No CSS Modules, no Sass, no CSS-in-JS, no inline styles, no style
objects and no JSX `style` prop, including for data-driven values (use bucketed `data-*`
attribute selectors instead). Reach for `packages/design-system/src/styles/chrome.css`, through its React wrappers,
before writing screen CSS.
_Why:_ about forty screens share one chrome. See [`docs/stack.md`](docs/stack.md#styling--plain-css-global-block-element-class-names).
_Check:_ review; stylesheet-as-text tests in `chrome.test.ts`.

**P16. Every string the player sees is a dictionary key, in all three languages (ca, es,
en).** Sentences are whole and never assembled from fragments. Every language takes the same
`{parameters}`. Club and competition names are not translated.
_Why:_ word order moves between languages, and a mistranslated parameter renders as a literal brace.
_Check:_ `dictionaries.test.ts` (parity both ways, no blanks, same parameters). It cannot see
an orphan key, so grep by hand.

**P17. Art is parameterised or generated, never traced.** Anything that takes live data (a
badge from club colours, the radar, the pitch, 18px icons) is drawn in code, with geometry in
`.ts` and colour in `.css`. Box art drawn once and only ever selected may be generated
([ADR 0012](docs/adr/0012-generated-cover-art.md)). Nothing reproduces PC Fútbol's screens,
icons or artwork, and nothing draws a real crest
([ADR 0007](docs/adr/0007-intellectual-property.md)).
_Check:_ `art.test.ts`, `badges.test.ts`; review.

**P18. A club is its city.** Where a city has a second club in a division, it takes its
district or ground, never a crowd nickname. Real club names are a user-supplied import only.
Opening squads follow [ADR 0010](docs/adr/0010-real-squad-shapes.md); everyone generated
afterwards comes from the name pools.
_Why:_ a city name is not a trademark; a crest is. This is a legal constraint.
_Check:_ review; `rosters.test.ts` (no two shipped players share a name).

**P20. Every screen works on a 390px phone and looks the same on the desk.** No sideways
page scroll, every control at least 24px to press, one phone breakpoint (`width < 40rem`).
Phone rules live behind that breakpoint or `pointer: coarse`, never in the desk's rules.
_Why:_ people open a shared link on their phone, and the desk layout is already right.
[ADR 0018](docs/adr/0018-mobile-layout.md), [ADR 0019](docs/adr/0019-phone-shell.md).
_Check:_ `breakpoints.test.ts`; the screen stories at 390 and 768 in Storybook; the
full-game screenshot comparison at 1280.

## Process

**P19. Knowledge lives in its file.** How to work goes in `AGENTS.md`; rules go here; how it
is built goes in `architecture.md`; why goes in an ADR; work goes in `tasks.md`; risk goes in
`security.md`; model findings go in the `docs/` reference they belong to.
_Why:_ a session log in the agent file hides decisions from the next person.
[ADR 0013](docs/adr/0013-project-knowledge-files.md)
