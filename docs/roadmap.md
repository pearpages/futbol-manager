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

## M2 — Result resolver ✅

**~2 weeks · done 2026-08-13**

Squad strength → scoreline. Poisson-ish goal model with home advantage, driven by the `attack` / `defence` ratings defined in [attribute-model.md](./attribute-model.md#bridge-to-m2--the-resolver-contract). Season-long calibration: goals per game, home win rate, points spread of champion vs relegated.

The harness from M1 is now the regression net. Its bands were **tightened** from "a coin flip passes" to real distributions; every subsequent balance change has to keep them green. This is the highest-value test in the project.

**Exit — met.** Calibrated over 50 seasons: **2.70 goals/game, 45.5% home wins, 23.6% draws, champion 87.1 (76–98), 18th on 33, spread 61.5.** Over 200 seasons the top-rated club takes 51% of titles, the runner-up 37%, third 11%, with occasional surprises — and mid-table clubs are sometimes relegated.

Goals are Poisson-distributed with the mean set on a log scale, so ratings compose multiplicatively and λ can never go negative:

```
λ_home = exp(BASE + SLOPE × (home.attack − away.defence) / SCALE + HOME_EDGE)
```

**Club ratings here are provisional.** M2 predates players, so `Club` carries `attack`/`defence` directly. M3 replaces the _supplier_ — the rating is derived from the selected XI — and `resolveFixture`'s signature does not change.

---

## M3a — Players and lineups (headless) ✅

**done 2026-08-13**

**M3 was split.** As written it bundled the player/lineup domain model with the entire first UI, which is why it carried a 3-week estimate against M1's 1.5 and M2's 2. The exit criterion is a _statistical_ claim, so the harness settles it headlessly — and the screens then get built against a model already known to work.

Player entity implementing [attribute-model.md](./attribute-model.md) — eight attributes on 1–99, four positions, weighted `overall`, age derived from `birthDate`. Deterministic squad generation, ~23 players a club. Formations, a tactical slider, and the XI → `TeamRating` collapse feeding the resolver.

**Exit — met.** A mid-table club forced to field its worst legal XI loses **14.8 points and 5 league places** over a season, averaged across 20 seasons. Asserted in the harness, not claimed.

Two things worth recording:

- **Squad generation round-trips club strength.** A club rated 88/85 generates a squad whose best XI collapses back to 88/85 within ±3, across every club and 20 seasons. That is what kept M2's calibration valid — every distribution band passed unchanged once squads replaced club ratings.
- **The tactical slider had to be made asymmetric.** A symmetric attack/defence trade is strictly exploitable: under three-points-for-a-win, converting a draw into a 50/50 result is worth +0.5 points, so all-out attack was measured at **+2.1 points a season** for free. Both extremes now surrender 1.6× what they gain, which makes the slider a decision — a strong side gains from attacking, a weak side is punished for it.

Also here: the **save migration chain** (`migratePayload`, an ordered forward-only list, and a committed `v1.json` fixture save), because adding players was the first real schema change. See [ADR 0005](./adr/0005-persistence.md).

---

## M3b — The first screens ✅

**~1.5 weeks · done 2026-08-13**

Table, squad, ficha and lineup screens; the Zustand store; navigation; the first real `chrome.css` primitives; and save/load, because a game you cannot save is not playable in the sense ground rule 6 means.

**Exit — met.** You can open the game, read the classification, browse the squad, open a player, change formation and approach, advance the day and watch results land. A best-XI vs worst-XI season driven entirely through the UI's own store shows the points gap.

**The look is a 1999 Spanish CD-ROM, not a terminal.** The default retro answer — dark background, acid-green monospace, scanlines — is 1980s BBS and wrong for the subject. Dinamic's visual language was _hardware_: bevelled panels you could press, with data sunk into inset screens. So the chrome has two materials, and the distinction is structural rather than decorative:

- `.panel` — raised, bevelled, holds controls and labels
- `.screen` — recessed, dark, holds data

The one real information device is the **position band**: a colour spine on each table row. That is how every Spanish classification is read, so it encodes qualification rather than decorating a row — **1 champion, 2–4 Champions League, 5 Europa League, 6 Conference League, bottom 3 relegated**, with a legend under the table and text for readers who cannot use colour. The signature is the **ficha** — the player card with eight attribute bars.

Three decisions worth recording:

- **No router.** Navigation is a value in the store. This is a game, not a site: there are no URLs to share and no back button to honour, so a router would be a dependency bought for nothing.
- **Attribute bar widths use bucketed `data-fill` attribute selectors**, not a JSX `style` prop. The styling convention has no exception for data-driven values, and 5% steps are visually indistinguishable from exact.
- **Lineup validation lives in the reducer, not the screen.** `SetLineup` runs `startersOf`, so an illegal XI cannot reach a matchday through any route — a screen can forget, the reducer cannot.

---

## M3c — Open questions before M4

The manager currently starts at **Almería**, the weakest club, because `newSeason` defaults to the last-rated. That is a deliberate "hard game" default but it was never chosen — a club-picker at new-game is the obvious fix and takes an hour.

**Nothing has been looked at in a browser yet.** The Chrome extension has not connected across two attempts, so the UI is verified by build, tests and rendered-DOM dumps only. The layout, bevels and colour have never been seen.

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
Derivation layer mapping FBref/StatsBomb per-90 stats onto the eight attributes — skeleton mapping table already in [attribute-model.md](./attribute-model.md#bridge-to-the-data-pipeline). Pure functions, unit-tested. openfootball for club and league structure.

**Ships with unlicensed city names by default** — a club is its city (Madrid, Barcelona, Sevilla), and a city's second club takes the district or ground it is identified with (Manzanares, Heliópolis, Sarrià, Vallecas). A city name is not a club trademark. Real club and player names stay a user-supplied import. Player names are generated from Spanish name pools, never lifted from real squads — there is no city-name equivalent for people.

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
