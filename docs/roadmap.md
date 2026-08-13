# Roadmap — PC Fútbol-style Manager

**Scope:** Football management game in the spirit of PC Fútbol 2001. No real-time match engine — results resolved statistically. Fictional clubs/players by default, with dataset import as an opt-in layer.

**Estimates** are in _focused weeks_ (~35h). For evenings-and-weekends (~10h/week), multiply by ~3.5.

---

## Ground rules

These are invariants, not preferences. Every one of them exists to keep later phases additive rather than rewrites.

1. **`domain` has no dependencies except a seeded PRNG.** No React, no `fetch`, no `Date.now()`, no `Math.random()`.
2. **State changes only through `reduce(state, command, rng)`.** The UI dispatches commands and renders from emitted events. It never mutates.
3. **Every save carries `schemaVersion` and a migration chain.** From the very first save file. Non-negotiable.
4. **Day-level ticks.** Not weeks. Contract deadlines, injury recovery and training all want days.
5. **No generalisation without a second case.** One hardcoded league until a real second competition forces the abstraction.
6. **The game must be playable at the end of every milestone.** Boring is fine. Broken is not.

**Consequence of 1 + 4, and it lands in M1, not M6:** the day clock is _state_, not wall time. `Season` carries a `currentDate` that only the tick advances, and every save round-trips it alongside the PRNG state. Nothing anywhere reads the system clock. Build it this way in M1 and M6's day pipeline is a place to hang functions; retrofit it later and M6 is a rewrite.

---

## Package layout

```
packages/
  domain/        pure TS — entities, reducer, pipeline, resolvers
  data/          adapters: raw datasets → domain entities
  persistence/   save/load + migrations (IndexedDB, JSON export)
  app/           React + Vite
```

Every tool and version is pinned in [stack.md](./stack.md) — the single place a version number is decided. **pnpm workspaces**, no Turborepo, per [ADR 0001](./adr/0001-workspace-tooling.md).

Dependency direction is strictly `app → persistence → data → domain`, enforced twice: by pnpm's strict `node_modules` layout, and by an ESLint rule that names the violation in English. Both were in place on day one; it took ten minutes and saves an afternoon of untangling later.

---

## M0 — Skeleton ✅

**~0.5 weeks · done 2026-08-13**

Monorepo, Vite, Vitest, strict TS config, import-boundary lint rule. A Vitest `projects` config so one command runs every package. Seeded PRNG module — `sfc32`, per [ADR 0002](./adr/0002-prng.md) — with its own tests (same seed → same sequence, across serialise/deserialise).

**Exit — met:** `pnpm test -- --run` green across all four packages plus a `boundaries` project; the boundary rule fails the build when `domain` imports React, and `tests/boundaries.test.ts` asserts that it does. Full stack recorded in [stack.md](./stack.md).

---

## M1 — League skeleton ✅

**~1.5 weeks · done 2026-08-13**

Core entities: `Club`, `Competition`, `Fixture`, `Season` (carrying `currentDate`, per the ground rules). Round-robin fixture generation for **20 clubs over 38 rounds**. League table computation with the full Spanish tiebreaker chain: points → head-to-head points → head-to-head goal difference → overall goal difference → goals for. One hardcoded competition (ground rule 5). See [ADR 0003](./adr/0003-league-format.md).

Dummy result resolution — pure coin flip, placeholder.

**Also here: the N-season headless harness.** Pulled forward from M2 deliberately. Build the runner and the distribution assertions now, against the coin-flip resolver, with bands loose enough that a coin flip passes. M2 then only has to _tighten_ the bands, instead of building the tool while simultaneously trying to tune against it. See the Risks section — this is the mitigation for the project's most-underestimated cost, and it is worth having before there is anything to calibrate.

No players yet. No decisions yet.

**Exit — met:** `pnpm season` simulates a full 38-round season and prints the final table, byte-identical across runs for a given seed. The harness runs 50 seasons and asserts.

Two decisions taken here, both following from the ground rules rather than overriding them, so neither got an ADR:

- **Dates are an integer day number** (`DayNumber`, branded), with `fromCivil`/`toCivil` as the only calendar code. Adding days and comparing dates are the hot-path operations and become `+` and `<`; `currentDate + 1` is literally the tick. The conversion pair is round-trip tested across every day from 1900 to 2300.
- **`reduce(state, command, rng)` exists from M1**, with one command and three events. Ground rule 2 is an invariant and M1 mutates state — but the deciding reason is that the harness must drive the same door the UI will. A regression net that exercised private helpers would verify a path that never ships.

---

## M2 — Result resolver

**~2 weeks**

Squad strength → scoreline. Poisson-ish goal model with home advantage, driven by the `attack` / `defence` ratings defined in [attribute-model.md](./attribute-model.md#bridge-to-m2--the-resolver-contract). Season-long calibration: goals per game, home win rate, points spread of champion vs relegated.

The harness from M1 is now the regression net. **Tighten its bands** from "a coin flip passes" to real historical distributions, and treat every subsequent balance change as something that has to keep them green. This is the highest-value test in the project.

**Exit:** simulated league tables look plausible against real historical distributions. Champion lands ~85–95 points, not 130.

---

## M3 — Players and lineups

**~3 weeks**

Player entity implementing [attribute-model.md](./attribute-model.md) — eight attributes on 1–99, four positions, weighted `overall`. Lineup selection, formations, basic tactical sliders feeding the resolver. Squad screen, player detail screen.

The attribute model is specified rather than spiked: the eight attributes, the position weights, the age curve, and — critically — how a starting XI collapses into the two numbers M2 already consumes. Implement against that document; if something needs to change, change it there first.

**Exit:** you can pick a starting XI, and picking a bad one demonstrably costs you points over a season.

---

## M4 — Transfers

**~4 weeks**

Transfer windows. Player valuation. Bids, counter-bids, contract negotiation (wage, length, signing bonus). AI clubs that buy and sell plausibly — the hardest part here by a distance.

AI transfer logic wants to be a scoring function over squad needs, not a rule tree. Rule trees in transfer markets produce clubs that stockpile goalkeepers.

**Exit:** sim ten seasons headless with no human input; squads should still look reasonable and no club should own 40 players.

---

## M5 — Economy and board

**~3 weeks**

Budgets, wage bill, ticket pricing, sponsors, TV money, prize money. Board objectives and the sack mechanic. Stadium capacity.

This is the milestone that makes M4 _mean_ something — without a constraint, transfers are a shopping trip. Expect to spend more time tuning than coding.

**Exit:** 50-season headless run where no AI club goes bankrupt and none accumulates an unspendable fortune.

---

## M6 — Living squad

**~3 weeks**

Injuries and recovery. Suspensions and card accumulation. Form and morale. Training with attribute progression and decline, driven by the age curve in [attribute-model.md](./attribute-model.md#age-curve). Each is a pure function inserted into the day pipeline:

```ts
const pipeline = [ageAndContracts, injuries, training, morale, aiTransfers, playMatches, finances]
```

**Exit:** a 34-year-old declines, a 19-year-old improves, and an injury crisis is survivable but painful.

---

## M7 — Competitions and depth

**~4 weeks**

Domestic cup with knockout brackets. Second division with promotion/relegation. Continental competition. Youth academy generation. Scouting with fog-of-war on unscouted players' attributes.

This is also where ground rule 5 finally releases: the second competition is the real second case, so the hardcoded league from M1 earns its abstraction here and not before.

Fog-of-war is worth doing properly: store true attributes, expose an estimate whose error narrows with scouting investment. It's what makes signings feel like decisions rather than lookups.

**Exit:** a full career across divisions is coherent — promotion changes your finances, Europe changes your fixture congestion.

---

## Cross-cutting tracks

Run these alongside, not as separate phases.

**Data pipeline** _(starts at M3, ~2 weeks total)_
Derivation layer mapping FBref/StatsBomb per-90 stats onto the eight attributes — skeleton mapping table already in [attribute-model.md](./attribute-model.md#bridge-to-the-data-pipeline). Pure functions, unit-tested. openfootball for club and league structure. Ships fictional by default; real-name import stays a user-supplied file.

**Save migrations** _(continuous)_
Every schema change gets a migration and a round-trip test against a stored fixture save from the previous version. Keep one fixture save per shipped version in the repo. See [ADR 0005](./adr/0005-persistence.md).

**UI** _(continuous from M3)_
Table-heavy screens reading from a store. Expect ~40 distinct views by M7. The retro chrome is fun to build, but each screen still needs wiring — budget for it.

The mitigation for the screen-count risk is a shared chrome layer (`packages/app/src/styles/chrome.css`) good enough that a new screen is markup and data wiring with no new CSS. That is why styling is plain global CSS with block-element names rather than per-component modules — see [stack.md](./stack.md#styling--plain-css-global-block-element-class-names).

---

## Totals

| Target                 | Focused weeks | Part-time  |
| ---------------------- | ------------- | ---------- |
| Playable slice (M0–M3) | ~7            | ~6 months  |
| Real game (M0–M5)      | ~14           | ~12 months |
| Full depth (M0–M7)     | ~21           | ~18 months |

---

## Explicit non-goals

Listed so they stay decided rather than getting relitigated at 1am:

- Real-time or 2D match visualisation
- Plugin architecture, generic competition DSL, rules engine
- Multiplayer
- Historical encyclopedia (this was an editorial team at Dinamic, not an engineering feature)
- Multiplatform builds before the web version is fun

---

## Risks

**Balance tuning is underestimated, always.** M2, M4 and M5 each carry a tail of tuning work that doesn't look like progress. The N-season headless harness is the mitigation — it is now an **M1** deliverable rather than an M2 one, so that by the time there is something to calibrate the tool already exists and is trusted.

**The attribute model is load-bearing.** Getting it wrong surfaces as vague "the game feels arbitrary" complaints in M4, three months after the mistake. _Now specified_ in [attribute-model.md](./attribute-model.md), including the M3→M2 contract. The residual risk has moved: it is no longer "we haven't decided", it is "the `pace` derivation from FBref has no direct source stat" — flagged in that document, to be resolved during M3's data work.

**Screen count is the silent cost.** The domain work is genuinely tractable; forty table screens is what actually eats the calendar.

---

## Decision log

Locked decisions live in [`docs/adr/`](./adr/). Read them before reopening a settled question.

| ADR                                      | Decision                                                      |
| ---------------------------------------- | ------------------------------------------------------------- |
| [0001](./adr/0001-workspace-tooling.md)  | npm workspaces, no Turborepo                                  |
| [0002](./adr/0002-prng.md)               | `sfc32` seeded PRNG                                           |
| [0003](./adr/0003-league-format.md)      | 20 clubs, 38 rounds, Spanish tiebreakers                      |
| [0004](./adr/0004-attribute-model.md)    | Eight attributes, not thirty                                  |
| [0005](./adr/0005-persistence.md)        | IndexedDB + JSON export, versioned saves                      |
| [0006](./adr/0006-typescript-6-not-7.md) | TypeScript pinned to 6.x — typescript-eslint caps at `<6.1.0` |
