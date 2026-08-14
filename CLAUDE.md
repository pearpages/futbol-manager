# futbol-manager

A PC Fútbol 2001-style football management game. No real-time match engine — results are resolved statistically. Fictional clubs and players by default; dataset import is an opt-in layer.

**Read before working:** [`docs/roadmap.md`](docs/roadmap.md) for what to build and in what order, [`docs/stack.md`](docs/stack.md) for every tool and version, [`docs/attribute-model.md`](docs/attribute-model.md) for the player spec, [`docs/market-model.md`](docs/market-model.md) for what a player is worth and who will sell him, [`docs/adr/`](docs/adr/) for settled decisions. Do not reopen an ADR's question without saying why the ADR is wrong.

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
pnpm season [seed]              # headless season, prints the final table
pnpm fixture                    # write a save fixture for the CURRENT schema version
                                # — run it before adding the next migration, never after
pnpm typecheck
pnpm lint
pnpm format
pnpm dev                        # app only
```

## Conventions

- **Styling:** plain `.css`, global, with block-element class names (`.squad-screen__row`). No CSS Modules, no Sass, no CSS-in-JS. Never inline styles, style objects, or a JSX `style` prop. Shared chrome lives in `packages/app/src/styles/`; reach for `chrome.css` before writing screen-specific CSS, and add a primitive there the _second_ time a screen needs it. See [`docs/stack.md`](docs/stack.md#styling--plain-css-global-block-element-class-names).
- **Imports:** relative imports use `.ts` / `.tsx` extensions, never `.js`. This is what lets `node scripts/*.ts` run package sources with no extra tooling.
- **Dates:** never a `Date`. A date is a `DayNumber` — an integer day count — from `packages/domain/src/time.ts`. Add days with `addDays`, compare with `<`, convert for display with `toCivil`/`formatDate`. All calendar arithmetic belongs in `time.ts`, nowhere else.
- **State changes:** through `reduce(state, command, rng)` only. New commands go in `reduce.ts`; the `AdvanceDay` handler is where M6's day pipeline will hang its pure functions.
- **Club naming:** a club is its **city** (Madrid, Barcelona, Sevilla). Where a city has more than one club in a division, the second takes its district or ground — Manzanares, Heliópolis, Sarrià, Vallecas — never a crowd nickname, which reads wrong in a table. A city name is not a club trademark; real club names stay a user-supplied import. Follow this when adding a second division rather than inventing composites. **Player** names have no city equivalent, so generate them from Spanish given-name and surname pools — never lift a real squad.
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

### 2026-08-13 (d) — M1 ✅

**Done.** Entities, round-robin for 20 clubs over 38 rounds, Spanish tiebreakers, coin-flip resolver, `reduce`, and the 50-season harness. `pnpm season` prints a final table, byte-identical across runs for a given seed. 93 tests green.

**Two design calls, both following from existing ground rules, so neither got an ADR:**

- **`DayNumber`** — a date is an integer day count, with calendar code confined to `time.ts` and round-trip tested across every day from 1900 to 2300. Chosen because _add days_ and _compare_ are the hot-path operations and become `+` and `<`; `currentDate + 1` is literally the tick.
- **`reduce` from M1** — the deciding argument was that the statistical harness is the regression net for M2/M4/M5, and a net only covers what it drives. It has to go through the same command path the UI will.

**Convention change:** relative imports now carry `.ts`/`.tsx` extensions (`allowImportingTsExtensions`). That is what makes `node scripts/season.ts` work with no extra tooling — Node strips types natively but will not rewrite `.js` back to `.ts`. Avoided adding `tsx`.

**Two things worth remembering**, both surfaced by tests rather than review:

- Venue assignment keyed on `(round + pairing)` gave the fixed club **19 consecutive home games**. A club's carousel index grows with the round, so the two terms cancel and parity never changes. Venue must key off the club's own index.
- The harness's champion-points figure (~65–71 under a coin flip, against 85–95 in real football) is the single clearest marker of what M2 has to achieve.

### 2026-08-13 (e) — M2 ✅

**Done.** Poisson goal model with log-scale means and home advantage, provisional club ratings, harness bands tightened. 110 tests green.

**Calibrated over 50 seasons:** 2.70 goals/game · 45.5% home wins · 23.6% draws · champion 87.1 (76–98) · 18th on 33 · spread 61.5. Over 200 seasons titles split 51/37/11% across the top three rated clubs with a few surprises, and mid-table clubs occasionally go down. Only one constant needed changing after the first run — `BASE`, because goals/game came out at 3.07 against a real ~2.7.

**`Club.attack` / `Club.defence` are provisional and M2-only.** M2 predates players, so ratings sit on the club. The resolver takes a `TeamRating` parameter, so **M3 replaces the supplier, not the signature** — derive the rating from the selected XI per `attribute-model.md` and `resolveFixture` is untouched. `packages/domain/src/test-clubs.ts` holds the league used by domain tests, because `domain` cannot import `@fm/data` (wrong direction).

**Latent M1 bug fixed:** `advanceDay` matched fixtures on an exact date, so any fixture the clock had passed was skipped forever. Now `fixture.date <= today` — "play everything due". Harmless until something jumps the clock, and "continue to next match" is exactly that.

**On the harness:** when a change pushes a band out, retune the model — do not widen the band. The structural invariants (goals conserved, points arithmetic, every win someone's loss) are never negotiable. M2 added the tests a coin flip could not support: strong clubs finish high _on average_, upsets still happen, and the spread collapses when every club is rated identically — that last one is what would catch a resolver silently ignoring its input.

### 2026-08-13 (f) — M3a ✅

**M3 was split.** As written it bundled the player/lineup domain with the entire first UI. Its exit criterion is a statistical claim, so the harness settles it headlessly and M3b's screens get built against a model already known to work.

**Done.** Player entity per `attribute-model.md`, deterministic squad generation (~23 a club), formations, tactical slider, the XI → `TeamRating` collapse, and the save migration chain. 190 tests green.

**Exit criterion, measured:** a mid-table club forced onto its worst legal XI loses **14.8 points and 5 places** over a season across 20 seasons.

**Squad generation must round-trip club strength.** A club rated 88/85 generates a squad whose best XI collapses back to 88/85 within ±3. This is load-bearing: it is why every M2 distribution band passed _unchanged_ when squads replaced club ratings. `calibrateSquad` solves for the offset rather than hand-tuning constants, so changing the position weights in `attribute-model.md` cannot silently shift club strength. **If a band ever moves, fix generation — never the band.**

**The tactical slider is deliberately asymmetric.** A symmetric attack/defence trade is strictly exploitable: under three-points-for-a-win, converting a draw into a 50/50 result is worth +0.5 points, so all-out attack measured at **+2.1 points a season for free**. Both extremes now surrender 1.6× what they gain. Measuring caught a second bug in the fix itself — applying the penalty to the _signed_ shift made defending gain more than it cost, another free win. The penalty must always apply to the side being reduced.

**Migration chain now exists** (`packages/persistence/src/migrations.ts`): ordered, forward-only, refuses a save from the future rather than guessing, with a committed `fixtures/v1.json` to migrate against. Adding a schema change means adding a migration _and_ a fixture save for the version you are leaving.

### 2026-08-13 (g) — M3b ✅

**Done.** Table, squad, ficha and lineup screens; Zustand store; navigation; the first real `chrome.css`; and IndexedDB save/load, since a game you can't save isn't playable in the sense ground rule 6 means. 202 tests green.

**The visual direction is a 1999 Spanish CD-ROM, not a terminal.** Two materials, and the split is structural: `.panel` is raised bevelled hardware holding controls, `.screen` is a recessed dark display holding data. Every new screen picks one. The position band on table rows is the one real information device — it's how a Spanish classification is read. Tokens and primitives live in `packages/app/src/styles/`; **reach for `chrome.css` before writing screen CSS**, and add a primitive there the _second_ time a screen needs it.

**Decisions a later session should not relitigate:**

- **No router.** Navigation is a `Screen` value in the store. It's a game — no URLs to share, no back button to honour.
- **Attribute bar widths use bucketed `data-fill` attribute selectors, not a JSX `style` prop.** The styling convention has no exception for data-driven values. 21 rules in `chrome.css`, 5% steps, visually exact.
- **Lineup validation lives in the reducer.** `SetLineup` runs `startersOf`, so an illegal XI can't reach a matchday by any route. Screens forget; the reducer can't.
- **`restore()` swallows storage errors.** Private browsing, a blocked origin or a test with no IndexedDB should land the player in a fresh season, not a blank screen.

**Gotcha that cost time:** Testing Library only auto-cleans when Vitest globals are on, and they're not — tests import `describe`/`it` explicitly. Without `afterEach(cleanup)` every `render` stacked into one document and queries found duplicates. Now in `packages/app/src/test-setup.ts`, wired via the app project's `setupFiles`, so all future screen tests inherit it.

**Two things I could not verify and one that needs your call:**

- **Nothing has been looked at in a browser.** The Chrome extension wasn't connected, so verification was the build, the test suite, and a rendered-DOM dump. The layout, bevels and colour have never been seen.
- **The manager starts at Almería** — the weakest club — because `newSeason` defaults to `clubs.at(-1)`. Defensible as a hard-mode default but never actually chosen. A club picker at new-game is about an hour.

### 2026-08-14 — what actually moves results

Prompted by "how can I win games with Almería?", which turned out to have a precise answer worth writing down. Full numbers in [`docs/attribute-model.md`](docs/attribute-model.md#what-actually-moves-results).

**A team rating is not the average of the XI — it is a heavily weighted one.** In 4-4-2, attack is FW 45% / MF 41% / DF 14%; defence is **GK 35%** / DF 41% / MF 21% / FW 3%.

**Read this before writing M4's valuation model.** Measured in league points, one starter upgraded to 90: **goalkeeper +10.5**, defender +4.1, forward +3.8, midfielder +2.9. A goalkeeper is worth roughly **2.5× any other single signing**, straight out of `KEEPER_WEIGHT = 0.35` in `lineup.ts`. If AI valuation prices players on `overall` alone, the human buys every decent keeper in the league and the market is broken — and that is the kind of thing discovered three weeks into M4 otherwise.

Three things that measured as _not_ mattering, so nobody spends time on them: formation (under 1.5 points across all four, because generated squads are balanced — this changes at M4); resolver-aware lineup selection (`bestXI` by `overall` is already within 0.1 points of optimal); and tactics (upside 0–3, downside −4 to −9 — the default wins everywhere).

**All of these move when the M2 calibration does.** Re-measure rather than trusting the tables.

### 2026-08-14 — M3c ✅

**"M3c" was a heading over four open questions, not a milestone.** Two were work; two were not (browser verification needs your eyes, and the agency finding belongs to M4). Turned into a real milestone with an exit criterion: _you pick your club, and the best tactical approach differs by how good that club is._

**Club picker.** `newSeason` defaulted to `clubs.at(-1)`, so every career started at Almería — never chosen, and the club with the least to play for. `SetupScreen` now lists all twenty with ratings and prospects; `store.needsSetup` distinguishes "no career yet" from "career loaded".

**Tempo — `TeamRating` gained a third number.** The slider only redistributed strength between attack and defence, so nothing described how _open_ a game was. `tempo` is applied to **both** sides' expected goals: fewer goals → more draws → worth far more to the weaker side. Best approach now runs with strength: **Madrid +3.5 attacking, Almería +2.9 with a low block, mid-table punished either way.**

**The property that made this safe, and the one to preserve:** at balanced tactics the term is algebraically zero, so every M2/M3a harness band passed _unchanged_ and `pnpm season` is byte-identical. Extending a calibrated model without re-tuning it depends on the new term vanishing in the default case — design future modifiers the same way.

`MODEL.TEMPO = 0.6` sits between two failures: below ~0.4 the effect is inside the noise; above ~0.9 the strongest club gains 7+ points for always maxing out, which is a dominant strategy wearing different clothes. **If you retune it, the test to keep green is that the best approach _differs_ by club strength** — not that any particular setting is good.

**A gap worth knowing:** the harness runs every club on balanced tactics, so **it cannot see tactical exploits at all.** The M3c test covers this for now by driving tactics explicitly; a broader tactical sweep in the harness would be the real fix if the model grows more levers.

### 2026-08-14 — M4a ✅

**Split, per the roadmap's own exit criterion** — "sim ten seasons headless with no human input" has no human in it. M4b is the player's side.

**Three prerequisites the roadmap did not mention.** No season rollover (`simulateSeasons` regenerated all 460 players yearly, so squads could not drift and the criterion was unmeasurable), no contracts, no money. All three landed. Ageing came free from `birthDate`.

**`market.ts` is a scoring function, not a rule tree.** Need = the marginal gain in team rating from adding a player. **Do not add rules capping goalkeepers or squad size** — a second keeper cannot enter the XI so his need is already zero, and squad size falls out of needs decaying. A cap would hide the bug the exit criterion hunts for.

**Exit met:** ten continuous seasons, champions rotating across four clubs, squads 18–25, mean age steady at 27, pecking order intact. **Money conserved exactly** — 27,854k every season. That invariant is never to be loosened.

**The harness earned its keep.** Squads carried forward with no retirement aged the league to a mean of 33.75 by season ten. Fixed with retirement from 33 plus a youth replacement at the same position — _not_ the youth academy, which is M7's scouting and development.

**Known imbalance, and it is M5's job:** money only moves between clubs, never in. After a decade the top three hold 21.5M of 27.9M and the bottom clubs are at single-digit thousands, so a small club eventually cannot buy. Revenue turns that ratchet into a cycle.

**A test was passing on luck and is now deterministic.** `App.test.tsx` compared two _single_ seasons and asserted the better XI won more points — an effect of ~7 points against season variance of the same size. Adding one rng draw for contracts shifted the stream and it failed. The statistical claim belongs to the domain harness at 20 seasons; the UI test now asserts the rating changes, which is what the UI actually needs to prove. **Watch for this shape** — any test comparing a single stochastic run is luck.

**Pending:** **M4b** — bids, counter-bids, contract negotiation, transfer screen and shortlist. Then **M5**, which is what makes the market a cycle rather than a ratchet.

**Open design question carried forward:** the tactical slider is a way to lose, not a way to win. Correcting M3a's free-attack exploit left _balanced_ dominant everywhere. A tempo term — defensive setups lowering total goals for both sides — would make the underdog's low block genuinely correct. Recorded in the roadmap's M3c; decide it deliberately rather than drifting.

### 2026-08-14 — M4b ✅

**Done.** Bids and counter-bids, personal terms, a free-agent pool, the market screen, a shortlist, and a season rollover the UI can actually reach. Six commands, all validated in the reducer. 309 tests green; `pnpm season` byte-identical to `0410926`; every M2/M3a/M3c band untouched.

**Exit met, and measured over 60 seasons:** a mid-table club that shops each summer finishes **+3 points and half a place** above the same club, same seed, standing still. A single +18-overall goalkeeper is worth **+3.3 points and 1.3 places**.

**The rule that made this safe, and the one to keep: the bid subsystem draws no randomness at all.** Bid resolution runs inside `AdvanceDay`, the path every calibrated band is measured through, so one `rng.next()` would move every band in the project. Answers compare against `askingPrice`, the delay is a fixed `madeOn + 2`, and incoming offers derive from `needFor`. Same discipline as M3c's `tempo` vanishing at balanced tactics: **extend a calibrated model only in ways that are inert when the new feature is unused.** If a band ever moves, something drew rng that should not have — find it, don't widen the band.

**Two scale problems that only a human could expose.** The AI never noticed either, because its `VALUE_FOR_MONEY` filter only ever buys cheap marginal players:

- **Budgets were a fraction of one player's price.** A club rated 62 held 946k against a ~3,300k asking price for a player of its own standard. Measured: **48 of 228 listed players affordable to a mid-table club, and every one scored zero on need.** `seedBudget`'s base is now 2400, not 400 — the exponent is untouched, so every club's share of the money is unchanged, and a career at 4×, 6× or 10× produces an identical league. This is headroom for the manager, not for the AI. **The v3→v4 migration deliberately still writes the old 400 figure**; it records what v4 meant when v4 shipped, and `migrations.ts` is emphatic that a migration must not track a live constant.
- **Deleting unsigned free agents drained the pool to nothing.** Releases outnumber signings, so squads ground to the floor and then nothing more could be released: the pool went 45, 37, 15, 3, 0 and stayed empty from season six. A persistent pool balances itself. The variant that replaced every release with a youth was worse on every axis — squads hit the cap and mean age fell to 21.

**`contractExpiry` moved from `season.ts` to `player.ts`.** It describes a contract, and leaving it in `season.ts` closed a cycle the moment the rollover started asking the market who was still wanted. This also fixed a pre-existing latent cycle: `squad.ts` had been importing it from `season.ts`, which imports `squad.ts`.

**The reducer no longer rebuilds the manager's XI behind his back.** `applyTransfers` and `rolloverSeason` re-picked `bestXI` for _every_ club, so any two clubs trading wiped a hand-picked team sheet. AI clubs still revert to their strongest XI — it is the only place they pick a team, and skipping it leaves them fielding last year's. **Consequence worth knowing: signing a player no longer selects him.** That is correct for a manager and it is why the harness dispatches `SetLineup` after buying — the first measurement came out _negative_ because the signing was sitting on the bench.

**`scripts/fixture.ts` (`pnpm fixture`)** writes a fixture save for whatever version the build currently ships. **Run it before adding the next migration, never after** — the version is read from the live chain, so once `v5ToV6` exists the v5 fixture is unobtainable short of a checkout.

**Still not seen in a browser.** The Chrome extension failed to connect again, a fourth time. Verified by the build, 309 tests, and a rendered-DOM dump: a mid club with €5.7M sees an 88-rated forward at €14.1M it cannot afford and a reachable +5.0 upgrade at €4.6M, which is the intended shape of the decision.

**Pending: M5** — revenue, wage bill, board objectives. The seeded budget is now load-bearing for whether a manager can fix anything at all, so replacing it with income is the next real constraint. The signing bonus was deliberately deferred there.

### 2026-08-14 — M4c ✅ (the sell side)

**Prompted by a question, not a plan: "when and how will I be able to sell?"** The answer turned out to be "you already can, once a year, if you are lucky" — and chasing why exposed four defects stacked on top of each other. Worth remembering as a pattern: the feature looked finished and its tests were green.

**The visible bug.** Incoming offers were gated on `toCivil(today).d === 1` inside an open window. The clock enters every season on 15 August and `StartNewSeason` jumps straight to the next 15 August, so **1 July and 1 August are never reached** — exactly one generation day a year, 1 January, yielding at most one offer. Now `dayOfWeek(today) === 1` while the window is open.

**Three defects underneath it, each hidden by the one above:**

- **`expectedWage` came from `valuePlayer`, which multiplies by `contractFactor` — zero once a contract expires.** So every free agent _and every renewal in `rolloverSeason`_ was written on the 50 floor. Shipped in M4b and invisible. A fee collapses as a deal runs down; a wage does not. `playerWorth` is now the contract-free base and `expectedWage` uses it.
- **A free agent looked costless, so no fee was ever paid again.** need/fee gives a zero-fee player an unbeatable ratio; with one signing per club per window, every club took a free agent every time and the pool is never empty. Value is now need per **fee + wages**, and a club makes one paid signing _and_ one free transfer — genuinely different resources, since a free transfer does not touch the budget. **Keeping the paid rate at one preserves M4a's career comparability.**
- **`surplus` was computed once at window open and then trusted.** Two forwards each spareable alone left a club with two between them — no legal 4-3-3. Sales are re-checked against the live squad now.

**Squads were draining to the legal minimum.** Releases floored on `MIN_SQUAD`, so every club settled at exactly 18 — and `surplus` returns `[]` at 18, which freezes the whole market in both directions. Mean squad size measured 18.4 by season four. `RELEASE_FLOOR = 21` fixes it; squads hold at 18–23, pool ~45. **`MIN_SQUAD` is a hard floor, not a target — do not reuse it as one.**

**The transfer list.** `ListPlayer`, spare players only, re-filtered through `surplus` at window time. Listing is the consent, so a listed player who attracts a buyer is sold without a prompt. Sold, retired and released players are pruned from the list in `applyTransfers` and `rolloverSeason`.

**Numbers:** 332 tests, `pnpm season` byte-identical to `426f2f6`, M2/M3 bands untouched, money conserved. The M4b exit criterion re-measures at **+4.3 points / 2.2 places** (it briefly read +11.8 before the squad-drain fix — a signal that the _control_ arm was degrading, not that shopping had got better).

**Cost:** the weekly cadence roughly doubled suite runtime (4.5s → 9s), because `bestOfferFor` scores nineteen clubs and now runs ~7 days a season instead of one. Accepted deliberately. If it needs trimming later, cap the candidate spares — but note that restricting to a club's _best_ spares produces no offers at all, since the deals that exist are the cheap ones at the bottom.

**Still not seen in a browser** — fifth failed extension connection. Verified by a DOM dump of the full loop: list 12 spares → "Up for sale" panel with asking prices → roll over → one sold, budget €5.7M → €5.9M.

### 2026-08-14 — the market's 60-row cap

**Another one found by playing rather than testing: "60 of 228 shown — why can't I see the rest?"** A bare `.slice(0, 60)` in `MarketScreen`, with no filter, sort or pager, so the other 168 were unreachable.

**It was hiding exactly the wrong players.** The list sorts by how much a signing improves your XI, and the biggest improvements are the most expensive. Measured on a fresh season:

| Club    | Listings | Improve XI | Within budget | Both   | Affordable in the visible 60 |
| ------- | -------- | ---------- | ------------- | ------ | ---------------------------- |
| Madrid  | 228      | 0          | 228           | 0      | 60                           |
| Sarrià  | 228      | 66         | 209           | 47     | 41                           |
| Almería | 228      | 198        | 125           | **95** | **5**                        |

A weak club was shown sixty players it could not buy while ~90 useful, affordable signings sat below the cut — the opposite of what M4b's exit criterion needs. Cap dropped; position / within-budget / free-agent filters and sortable columns added. At Almería "Within budget" now surfaces a 79-rated midfielder at €1.1M for +6.0, which was previously invisible.

**Two things worth keeping:**

- **The listings memo is split on what each half depends on.** `needFor` is the expensive part and depends only on squads; `askingPrice` is cheap and depends on the date. `AdvanceDay` changes the date and leaves squad references untouched, so a single memo re-scored the entire market on every day tick.
- **`.sort()` mutates.** It is safe here only because every filter in the chain returns a fresh array — worth remembering before someone sorts a memoised array directly.

**Sorting is deliberately local to `MarketScreen`**, not promoted to `chrome.css`: it is the first sortable table, and the house rule graduates a primitive on its _second_ use.

**Cost:** 342 tests, 15s (was 9s). Rendering ~228 rows in ten market tests is most of it, and Testing Library's `getByRole` name computation over ~680 buttons is the rest. One test was flaking at 4.7s against the 5s timeout because it sat on the market screen clicking "Advance day"; it now waits on the table screen, which is what a manager does anyway and is down to 2.6s. **If the market table ever needs to be cheaper, paginate — do not reinstate a silent cap.**

### 2026-08-14 — the need score, documented and then hidden

**[`docs/market-model.md`](docs/market-model.md) is new** and is now the place to look before touching the market. It writes down `needFor` properly — the marginal-rating scoring function the whole market runs on, asked in three places and in both directions — along with valuation, windows, free agents and the balance invariants.

**Three things about `needFor` that are not obvious from the signature**, all now in the doc and its comment: zero is the normal answer rather than a bug (a player who would not displace anyone adds nothing, which is why a strong club scores zero on the whole league and why no rule against stockpiling keepers is needed); it always evaluates in 4-4-2 regardless of what you play, so it approximates under other shapes; and **it always returns a whole number**, because `teamRating` runs `clampRating`.

**That last one has teeth.** Four thresholds are written as fractions and collapse to two integer cutoffs — `RETAIN_THRESHOLD` 0.25, `NEED_THRESHOLD` 0.4 and `LISTED_NEED_THRESHOLD` 0.4 all mean **≥ 1**; `OFFER_NEED_THRESHOLD` 1.5 means **≥ 2**. They look independently tuned and are not. Move one across a whole number or do not bother.

**The "Improves" column is gone and the listing order is shuffled.** Showing the score turned the market into a lookup — read the top row, buy it. The order is now a deterministic shuffle seeded from `(window, managed club)`, so it holds still across renders, navigation and save/reload while January looks like a different market from August. All columns stay sortable; sorting by `Ovr` still finds good players, but nothing tells you whether they would get into your team. A column cycles descending → ascending → back to market order, so one click cannot cost you the shuffle.

**Two knock-ons worth knowing:**

- **Removing the column removed the screen's expensive half.** `need` was used by no filter and no panel, so ~228 `needFor` calls (two `bestXI` passes each) left every market render, and the two-memo split added for it collapsed back to one. The slowest app test went 4.7s → 2.4s.
- **The harness now knows more than the player does.** `market.human.harness.test.ts` shops with `needFor` directly, so its +4.3 points a season is a perfectly-informed manager — an upper bound, not what a person will get. Recorded in the doc.

`shuffle` moved from `market.ts` to `rng.ts` and is generic: a shuffle is a property of the generator, not of clubs. The market screen was the second case, which is what the house rule waits for.
