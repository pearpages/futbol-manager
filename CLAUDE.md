# futbol-manager

A football management game in the idiom of Dinamic's PC Fútbol. No real-time match engine — results are resolved statistically. Fictional clubs and players by default; dataset import is an opt-in layer.

**The first delivery targets PC Fútbol 5.0 (1996/97); the depth of the later games is the direction, not the v1 scope** — see [ADR 0008](docs/adr/0008-target-pc-futbol-5.md). M0–M5 is the 5.0-shaped game: one league, squads, tactics, transfers, an economy. M6–M7 is the drift toward 2001. Before adding anything, know which side of that line it sits on.

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
- **Club naming:** a club is its **city** (Madrid, Barcelona, Sevilla). Where a city has more than one club in a division, the second takes its district or ground — Manzanares, Heliópolis, Sarrià, Vallecas — never a crowd nickname, which reads wrong in a table. A city name is not a club trademark; real club names stay a user-supplied import. Follow this when adding a second division rather than inventing composites. **Player** names have no city equivalent, so generate them from Spanish given-name and surname pools — never lift a real squad. This is a legal constraint, not a stylistic one — see [ADR 0007](docs/adr/0007-intellectual-property.md).
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

**The visual direction is a 1996 Spanish CD-ROM, not a terminal.** 5.0 was the series' first Windows 95 entry, which is exactly where this vocabulary comes from. Two materials, and the split is structural: `.panel` is raised bevelled hardware holding controls, `.screen` is a recessed dark display holding data. Every new screen picks one. The position band on table rows is the one real information device — it's how a Spanish classification is read. Tokens and primitives live in `packages/app/src/styles/`; **reach for `chrome.css` before writing screen CSS**, and add a primitive there the _second_ time a screen needs it.

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

### 2026-08-14 — the target, and reference material

**Two ADRs, both prompted by asking whether we could just copy PC Fútbol.**

[**ADR 0007**](docs/adr/0007-intellectual-property.md) — the answer is mostly yes, and the premise was wrong. Dinamic went bankrupt in 2001 but the rights were sold on (Planeta DeAgostini → Gaelco → Gamick → Héctor Prats today, with PC Fútbol 8 on Steam); copyright runs to the 2060s. But **mechanics and systems are not protected** — CJEU _SAS Institute v World Programming_ — so the design is free. The name, the assets and their actual screens are not. **The real exposure was never Dinamic's**: club and player identity belongs to the clubs, the league and the players, which is the reason the city-name convention exists. What the data layer may _ship_ is deliberately left open for M3.

[**ADR 0008**](docs/adr/0008-target-pc-futbol-5.md) — **the first delivery targets PC Fútbol 5.0, not 2001.** Every doc said 2001, which is a finished product's feature list rather than a first release. The roadmap already sequenced it correctly — M0–M5 is the 5.0-shaped game, M6–M7 is the drift toward 2001 — so only the label was wrong. **The visual note was dated wrong too:** "a 1999 Spanish CD-ROM" is now 1996/97, and 5.0 being the series' first Windows 95 entry is what makes the bevelled-panel chrome the right idiom rather than a guess.

**"Scalable" here does not mean abstracting early.** Ground rule 5 stands. Growth is additive because of seams already in place — `reduce` as the single door, versioned saves, enforced boundaries, a resolver contract that swapped supplier at M3 without changing signature. The ladder is the plan.

**`assets/` holds 5.0 screenshots for reference, and is gitignored** — `assets/*` with `!assets/README.md`, so the rules are in the repo and no image ever is. Fifteen files, each opened and identified rather than trusted; `assets/pcfutbol-5.0/CONTENTS.md` says what each one is. The useful ones are the Menu Manager hub, "Jugadores a la venta", the squad/formation screen, a classification table and a top-scorers chart. **No player ficha turned up in any source tried** — the one screen most comparable to `PlayerScreen`, and the gap worth filling if a better source appears.

Two things in there worth arguing with later: PC Fútbol navigates from a **four-quadrant hub**, not a sidebar; and it shows player quality as **stars, not a number**.

### 2026-08-14 — hub, news feed, and a deliberate matchday

**Three problems, all "the player cannot see what is going on".** The app dropped you into the classification with a flat rail; everything the game did happened silently; and your own match was a side effect of a button you pressed repeatedly.

**The hub is home, and the rail stays.** `HubScreen` is four quadrants — Seguimiento, Entrenador, Mercado, Finanzas — around a centre carrying identity, next match and news, taken from `assets/pcfutbol-5.0/hub-menu-manager.jpg`. **Unbuilt tiles are shown disabled with the milestone that brings them**, so the hub doubles as a roadmap you can see; only milestones the roadmap actually assigns are named, which is why Calendario says "Not built yet" and promises nothing. Two tiles pointing at one screen (Clasificación/Resultados, Alineación/Tácticas) is deliberate — different questions, one screen for now.

**The news feed was a surfacing problem, not a data one.** The store's `feed` already carried every event; `TableScreen` rendered only `MatchPlayed`. `notifications.ts` turns an `Event` into a sentence with names and money resolved, and returns `null` for the noise — `DayAdvanced` fires every tick, and `LineupChanged`/`TacticsChanged` are your own clicks reported back at you. **A feed that reports your clicks is a feed nobody reads.** Other clubs' results are dropped too: nineteen a week would bury everything, and the table already lists them. `unread` is store-only — a session concern, so saves stay at v6.

**Matchday is now a separate press.** `nextFixtureFor` (domain, pure) plus `matchday.ts` answers the same questions for the shell bar and the hub. The primary button is a three-state machine — `Start 2027/28` / **`Play match v Sevilla (H)`** / `Advance day` + `To matchday`. **Round one is dated on the season start**, so a new career opens on _Play match_, never on _Advance day_ — worth knowing before it looks like a bug.

**The weak-XI warning exists because of M4c.** Signing a player no longer selects him, which is correct and silent; `weakLineup` compares the stored XI against `bestXI` and says so. A warning, never a block.

**Testing note that will bite again:** nine call sites queried the advance button by exact name, and it now has three labels. `src/testing.ts` holds one `ADVANCE` matcher plus `advance()`/`advanceUntil()` — use those rather than a literal. Several tests also assumed the app opens on the table; they click through to it now.

375 tests, `pnpm season` byte-identical. **One flake seen once and not reproduced** — a 5s timeout during a full run while other work was competing for CPU; the suite is 19s clean, and the app project's slowest test is 2.5s. If it returns, it is contention rather than the clock or the rng.

**Still not seen in a browser** — sixth failed extension connection. Verified by a DOM dump: bar reads `Next v Valencia (A) · today`, button reads `Play match v Valencia (A)`; after playing and three days it reads `Advance day` / `Next v Bilbao (H) · in 3d` with an unread badge, and the drawer shows "Cádiz offer €525k for Héctor Bermejo" — exactly the thing that used to pass unnoticed.

### 2026-08-14 — the nav rail is gone

**The hub made the rail redundant**, so the shell carried two competing navigations and the weaker one listed screens while the hub grouped them by the question being asked. PC Fútbol had no global navigation at all: a persistent title bar, the hub as the only branching point, and every other screen carrying its own action rail ending in **Volver**. That is now the model here.

- **`.shell` is a single column.** `NAV`, `.shell__nav` and `.shell__actions` are deleted — `grep shell__nav` returns nothing.
- **The bar is who · where · when**: club, the screen title, date, next match, Noticias. The title uses **the same words as the hub tile** that got you there, which matters more than it sounds with no rail to orient against.
- **`.screen-actions` is a chrome primitive**, used by Table, Lineup, Market (foot of the aside each already had) and Squad (a footer, since it has no aside). The ficha keeps its _contextual_ back: opened from a two-hundred-row market list, it returns to that list, never to the hub.
- **The day controls live on the hub and nowhere else** — inside the Next match panel, where they belong. Save and New career became **Grabar** / **Nueva carrera** in a utility strip beneath the news.

**The trade, accepted deliberately:** Market → Squad is two clicks through the hub instead of one. What it buys is that **every tick of the clock routes you past the news and the next fixture**, which is what the original complaint asked for.

**One thing this quietly broke, worth knowing.** The unread badge can no longer light up from advancing days: the only place to advance is the hub, and the hub clears unread on sight. Its remaining job is events that fire _off_ the hub — a bid, an offer, a listing — which is a smaller but real set, and what its test now covers. If the day controls ever come back to the bar, the badge regains its old purpose.

**Testing:** `src/testing.ts` now carries `openScreen(tile)` and `back()` alongside `ADVANCE`/`advance()`. **`advance()` only works on the hub.** Every screen test is hub → tile → assert → `back()`, and `App.test.tsx` walks all four live tiles in one test so an unreachable screen fails loudly. 375 tests, `pnpm season` byte-identical, no domain change at all.

### 2026-08-14 — club badges

Twenty rows of text was how you told clubs apart. Badges are kit colours, a shirt pattern, a shape, and the three-letter code the clubs already carried in `shortName`.

**Appearance is presentation, never state** — `Club` and the save format are untouched, so no schema bump and no migration. `badges.ts` holds geometry; `styles/club-badges.css` holds colour, keyed on **the palette name rather than the club**, so thirteen rules cover twenty clubs and the sharing is visible in the file.

**Shape is load-bearing, not decoration.** Following real kits puts **five clubs on red-and-white** (Manzanares, Bilbao, Girona, Granada, Almería), two on blue-and-white and two on yellow. The test that matters asserts **no two clubs share a `(colours, pattern, shape)` triple** — with a guard on the guard, since if every club had its own palette that test would pass trivially and prove nothing.

**On IP:** colours and simple geometric patterns are not protectable, so the palette is free. The line is crests and emblems, and these are abstract shapes carrying our own codes. Said out loud in `badges.ts` so nobody later reads "resembling the real ones" as licence to draw a coat of arms.

**Two things caught by rendering it rather than assuming:**

- The market's club column read **"GRAGRA"** — the badge already contains the code, so the adjacent text repeated it. Badge alone there now, with `aria-label` carrying the club name.
- **228 badges made the market screen genuinely expensive.** Each defined its own `<clipPath>`, so five outlines were declared a couple of hundred times; `<BadgeDefs />` now declares them once at the app root. That fixed the worst of it, but the screen still renders every listing by design, and three tests were tipping over the 5s default under five-way parallelism. The **app project now has `testTimeout: 15_000`** with the reasoning in `vitest.config.ts`: the slowest test is ~3s alone, so this is a scheduling budget rather than cover for a defect. **If that screen must get cheaper, paginate — never a silent row cap.**

384 tests, 23s, `pnpm season` byte-identical.

**Rim, added after.** There was already a border and it pointed the wrong way: a dark stroke, clipped to the shape so only the inner half showed, on badges sitting against a near-black screen. The navy, garnet and green badges got nothing — dark on dark on dark — while the white and yellow ones got a border they did not need. **The rim now contrasts with the badge's own field rather than with the background**, which gives every badge an edge and keeps working if one ever lands on a light `.panel`. Unclipped, so it reads as a border around the shape rather than an inner shade; `stroke-linejoin: round` because the lozenge and pennant come to points and a mitre would spike past the viewBox. The `drop-shadow` filter went with it — redundant, and it was a per-element filter on all 228 market rows.

**A test now reads `club-badges.css` and asserts each palette declares its three colours.** Colour lives in CSS and geometry in TS, so a palette can be named in one and undefined in the other; the result renders as an unfilled badge, which looks unpolished rather than broken. Note for anyone extending it: `import.meta.url` is not a file URL under vite-node, so that test resolves from `process.cwd()`.

**Then the rim was made a kit colour, which it had not been.** Six of the thirteen palettes were using near-white tints I had picked by hand to get contrast — they looked fine and were not colours the club owned. **`--badge-rim` now defaults to `var(--badge-b)` on `.club-badge`**, the club's second kit colour, which contrasts with the field by construction since the two are what the stripes are made of. Twelve palettes take that default and declare no rim at all. One override: **garnet-blue uses the gold ink**, because garnet and navy are both dark and cannot separate each other at a 0.8px hairline.

Two things fell out of it. `white`'s `--badge-b` changed from a pale grey to navy — it is never rendered as a mark, since that badge is `solid`, so it existed only for the rim and grey was barely an edge. And a test now forbids **any literal colour for `--badge-rim`**: an override must point at another badge token. Hand-picking is how the six neutrals got in, so the rule is enforced by construction rather than by care.

**The one weak pairing left is `sky`** — Vigo's white rim on sky blue is the lowest contrast in the set, because that kit has only two colours and no third to reach for. Following the rule strictly is the right call there; inventing a navy is what this change removed.

### 2026-08-14 — squad numbers, and the title bar

**Two small things, both "the screen is not telling me what I need".**

**`#` on the Plantilla rows.** Squad size is load-bearing — the reducer refuses a bid at `MAX_SQUAD` and a club at `MIN_SQUAD` can sell nobody — so "how many do I have" should not mean counting rows. `.data-table__num` already existed in `chrome.css` (it is what `TableScreen` uses for league positions), so the column cost no CSS at all. The test asserts the numbers run 1..N and that N equals the squad size, which is the actual point of the column rather than the presence of a cell.

**The title bar said who you are; it now says where you stand.** `Primera División · Jornada 6 · 12º` replaces the managed club's name — a fact that never changes and that the hub already states with a crest. Three notes:

- **The matchday is `matchday.fixture.round`, the round you are _about to play_.** `TableScreen`'s "Matchday" stat is `ceil(played / 10)` — _rounds completed_ — so **the two now disagree by one for most of a season**. That is a real inconsistency and it is a one-line fix in `TableScreen`; it was left alone because it is a screen this change was not asked to touch. Decide it deliberately.
- **Separators are drawn by `.shell__where > * + *::before`, not typed.** The season ending removes the matchday, so a typed `·` would leave a dangling separator.
- **`.shell__title` became the `<h1>`.** Removing the club name removed the only top-level heading, and the heading of a page should name the screen you are on. The competition strip is deliberately _not_ a heading — promoting it would collide with `App.test.tsx`'s `getByRole('heading', { name: /Primera División/i })`, which targets the table screen's own `<h2>`.

**The next opponent now carries his badge**, in the bar (`is-sm`) and in the hub's Next match panel (`is-lg`, matching the identity crest directly above it — the two clubs in the centre column read at the same weight). `matchdayFor()` already returned `opponent` as a full `Club`, so neither site needed a lookup.

**`position` is memoised on `game`.** The bar re-renders on every tick and `computeTable` walks all 380 fixtures; the reducer replaces `game` wholesale, so identity is the right dependency.

405 tests, `pnpm season` byte-identical to `a66d297`, no domain change. **Still not seen in a browser** — verified by a DOM dump: `Primera División · Jornada 1 · 14º` on a fresh career at Sarrià, `Next VAL v Valencia (A) · today`, and after a round `Jornada 2 · 20º` with `Next BIL v Bilbao (H) · in 5d`.

### 2026-08-14 — the four sections get a colour, the twelve tiles get an icon

**Prompted by the reference, not by a bug:** in 5.0 each hub quadrant has its own colour and every entry carries an illustration. Ours were four identical grey panels distinguishable only by reading the heading.

**What we took and what we did not.** The colour and the _idea_ of per-tile icons are free; the illustrations are not. [ADR 0007](docs/adr/0007-intellectual-property.md) names icons and artwork as the protected part — "designing in the idiom is the point; redrawing their screens is not" — so `TileIcon.tsx` is twelve glyphs drawn here, flat.

**Scope was settled by the reference itself.** `market-jugadores-a-la-venta.jpg` shows the destination screen in ordinary neutral chrome — no red anywhere. **The section colour lives on the hub and nowhere else.** One screen changed; the app did not.

**`aria-hidden` on every icon is load-bearing, not politeness.** Exploration counted **24 assertions across five test files** that resolve a tile by its exact accessible name — `openScreen()` alone is called 21 times with a plain string, and `testing.ts` matches whole-string. An icon contributing any text renames every tile, and two of those call sites sit in `beforeEach`, so whole suites would go down. The guard is a test asserting all twelve still resolve by name; **the fix was never to loosen `openScreen` to a regex**, because that exact match is the thing doing the work.

**The palette follows `club-badges.css`: a variant selector sets custom properties and nothing else.** Each section declares a face and an ink — **two values, not five — because the bevels are mixed from the face** with `color-mix()` rather than picked. That is the lesson the badge rim already paid for: six hand-chosen neutrals looked fine and were wrong, and the fix was deriving the colour from one that was already right. First use of `color-mix()` in the codebase; it is native CSS, needs no build step, and Sass colour functions are what the styling convention rules out.

Two contrast problems caught by reasoning about the materials rather than by a test:

- **A mid-tone heading on the near-black `.screen` is murky for three of the four hues.** The heading is `color-mix(…, #fff 45%)` of the face — one rule that lifts all four, instead of four hand-picked lighter tints.
- **`.button:disabled` sets `--fm-ink-soft`, a dark neutral meant for the grey panel face**, which disappears on a coloured one. Disabled tiles keep `--quad-ink` and let the inherited `opacity: 0.55` do the work, so an unbuilt tile still reads as part of its section rather than as a grey gap.

**Mercado is brick, not the reference's bright red.** `.hub__play` is already `--fm-relegation` and sits in the centre column, loud on purpose because that press is irreversible. Two saturated reds side by side would cost it exactly the distinctness it was given.

**Placement stopped keying on `:nth-of-type`.** Position followed position in `QUADRANTS`, so reordering that array silently rearranged the screen — and the rules were duplicated in the `width < 68rem` media query, which is the kind of pair that drifts. Both sets now key on `data-quadrant`, and a test asserts `nth-of-type` is gone (**stripping CSS comments first** — the comment explaining the change naturally names the thing it removed, which is how that test first failed).

**A pre-existing wart this surfaced and deliberately left alone:** a disabled tile's accessible name is `"CajaM5"` — no separator between the label and the milestone span. It is why the hub's own tests reach for `/Caja/` rather than an exact name. Hiding the badge from AT would fix it in one attribute, since `title="Arrives at M5"` already carries the information — but it predates this change and was not what was asked for.

418 tests, `pnpm season` byte-identical to `f42d5da`, no domain change. **Still not seen in a browser** — eighth failed extension connection. A DOM dump confirms the four `data-quadrant` values, twelve distinct icons all `aria-hidden`, and every accessible name unchanged. **The appearance is unverified:** nothing here proves four colours are distinguishable, that the brick separates from the Play button, or that a glyph reads at 1.35em.

### 2026-08-14 — M5a ✅ (where the money comes from)

**Split, for the reason M4 split.** M5's exit criterion — "50-season headless run where no AI club goes bankrupt and none accumulates an unspendable fortune" — has no human in it, no screen and no board conversation, while the milestone's prose names three UI tiles. So the harness settles the economy headlessly and **M5b** (Caja, Decisiones, Estadio, board objectives, the sack, ticket pricing) gets built against a model already known to balance.

**Done.** `finance.ts` — gate receipts, TV, sponsorship, prize money, the wage bill, the signing bonus deferred from M4b, debt with interest. Schema v7. 445 tests, `pnpm season` byte-identical to `f42d5da`, every M2/M3 band untouched.

**Exit met, over 50 seasons: 0 of 1000 club-seasons below the overdraft limit**, and the league total settles at 2.1× its opening figure rather than compounding. **The imbalance the milestone existed to fix is fixed — the top three held 77% of the league's money after a decade of M4a, and now hold 24%**; richest-to-poorest narrows from 8× to 3× over fifty seasons instead of widening.

**"Money is conserved" is gone and [ADR 0009](docs/adr/0009-the-ledger-identity.md) records what replaced it.** Every club carries a `ledger` (this season) and `lastLedger` (the one just closed); the invariant is that a balance moves by exactly `ledgerNet(after) − ledgerNet(before)`, **per club, on every tick**. That is stricter than what it replaced: the old test said the league had inflated, this one says which club and on which line. **`lastLedger` is not a convenience** — prize money lands in the same step that clears `ledger`, so without it the identity would have a hole exactly where the money moves.

**Three tuning findings, and the tuning genuinely was the milestone:**

- **Income has to be as convex as wages.** Wages scale ~`rating^3.5` because player value does; income modelled naively scaled ~`rating^2.8`. Rescaled uniformly that bleeds the big clubs and enriches the small ones — **inverting the table**, which is the exact failure `seedBudget`'s own comment warns about. Gate and sponsorship carry the convexity now; TV's equal share is the floor that keeps a struggling club solvent.
- **A fixed surplus compounds without limit, so the brake must grow with the pile.** The league's only other outflow is the signing bonus, and **AI transfer volume falls to zero from about season fifteen** as squads converge — a constant leak cannot balance a proportional inflow. Measured at **36× league growth over fifty seasons** before `WAGE_INFLATION` existed. A club holding more than a healthy reserve now pays over the odds for its players, which is both what happens in football and a cost already modelled.
- **That premium must tax the excess, not the balance.** Taxing the whole balance **vaporised four fifths of the league's money in season one** and would have quietly undone M4b's calibration that a budget buys two players of a club's own standard. `HEALTHY_RESERVE` is why a reserve is not a fortune.

**`seedBudget` survived as the opening balance.** The roadmap says revenue replaces the seed and it does — as the ongoing source. Replacing the seed _and_ the income together would have moved two things and left nothing to measure against, and `market.human.harness.test.ts` pins the seeded scale directly.

**The rng rule held, and `pnpm season` is the proof.** Attendance is a function of quality and league position rather than a draw — one `rng.next()` inside `AdvanceDay` would have moved every calibrated band in the project at once. It is also the more legible model: a crowd is not a coin flip.

**Three money tests were rewritten onto the ledger rather than the totals**, because completing a signing burns days and the clock now earns money while it does. Asserting `ledger.transfers` and `ledger.bonuses` is both immune to the clock and a sharper claim — it says no third club was touched.

**Debt exists but no AI club ever uses it.** Over 50 seasons the closest any came was 0.49× its limit _in credit_. The mechanism is exercised by unit tests, not by the career; the club that will actually go overdrawn is the human's, which is M5b's board's problem.

**Ordering trap, survived:** `pnpm fixture` must run **before** the new migration exists, because the script stamps the version from the live chain. `v6.json` did not exist on disk and would have been unobtainable once `v6ToV7` landed.

**Pending: M5b** — ticket pricing, stadium capacity as a decision, board objectives and the sack. The three `Finanzas` tiles are already there, disabled and badged.

### 2026-08-14 — M5b ✅ (the board, and somewhere for the money to go)

**Done.** `board.ts` — a target scaled to the club's standing, a warning, and dismissal on the second consecutive miss. Ticket pricing and stadium expansion. The three `Finanzas` tiles are live: **Caja**, **Decisiones**, **Estadio**. Schema v8. 488 tests, `pnpm season` byte-identical to `7282b36`, every M2/M3/M5a band untouched.

**Exit met:** the board sets a target, warns you, and ends the career at the club picker on the second miss. Caja states every ledger line against last season's, so the money M5a made move is money you can now account for.

**The board judges league position and nothing else** — a deliberate choice with a cost worth recording rather than discovering: **the overdraft M5a built still has no teeth.** A club may run to its limit and nobody mentions it. The Decisiones screen says so out loud, because the natural assumption is that money counts and it does not.

**Two defects found by rendering it, not by reasoning about it:**

- **A ticket rendered as "€0k".** `formatMoney` works in thousands — right for every other figure in the game and useless for the one price a supporter would recognise. `formatTicket` shows euros.
- **Charging the maximum was strictly best** — measured at €184k a match rising to €299k for slamming the slider — because the price was folded in _before_ `MIN_OCCUPANCY`, so the floor absorbed the damage. **This is the M3a tactics-slider exploit arriving by a different route**, and it is the second time this project has built a lever whose right answer was an end stop. Price is now a multiplier applied _after_ the clamp, and `PRICE_SENSITIVITY` is set from the algebra: takings are `p × (1 − s(p/p₀ − 1))`, peaking at `(1+s)/2s`, so **s = 0.5 puts the best price at 1.5× the default** rather than beyond the maximum. A test walks the whole range and asserts the peak is interior.

**What makes Estadio a decision is the pair of levers, not either one.** At the revenue-optimal price the ground is 42% full and expanding is worthless; at 0.7× it is 65% full and seats pay. Price alone remains an optimisation — what would make it a dilemma is supporters who resent being gouged, and that needs morale at M6.

**Where the board is evaluated, and why it differs from M5a's `settleSeason`.** On the `SeasonEnded` transition inside `advanceDay`, so the hub shows the verdict _before_ you press into the summer. M5a's prize money had to live in `rolloverSeason` because `simulateCareer` calls it directly and money changes how clubs behave; **the board changes nothing about how anybody plays**, so a headless career that is never judged still measures the same football.

**The target self-corrects on purpose.** It blends the club's standing with last season's finish, so overachieving tightens it and a bad season loosens it, clamped between winning it and surviving. A target that only ever tightened would become impossible — **it is the strike count that ends a job, not the arithmetic.** Strikes are consecutive, so meeting the target clears the slate; that is what makes a warning a warning rather than a countdown.

**The safety nets did their jobs, all three:**

- `notifications.ts`'s exhaustive switch **refused to compile** until every new event was handled — the price slider returns `null` (your own hand, like `TacticsChanged`), the verdict returns a real notice.
- `LEDGER_KEYS` plus the "every declared line is income or outgoing" test made the ninth line (`stadium`) impossible to add silently. ADR 0009's rule working as designed.
- `HubScreen.test.tsx`'s "shows what is not built yet" test **broke by design** when Caja went live, which is the point: a tile going live must not be able to pass as one that has not. Repointed at `Cantera`/`M7`.

**Two chrome primitives graduated on their second use**, as the `chrome.css` rule waits for: `.slider` (from the lineup screen) and `.number-input` (from the market). The occupancy gauge reuses the ficha's `.attr__track`/`.attr__fill` with a bucketed `data-fill` — never a JSX `style` prop.

**Trap survived again:** `pnpm fixture` must run **before** the new migration exists. `v7.json` would have been unobtainable once `v7ToV8` landed.

**Still not seen in a browser** — ninth failed extension connection. Verified by 488 tests and a DOM dump of all three screens: Estadio reads `Aforo 47,485 · Ocupación 56% · Por partido €184k`, Decisiones reads `Sarrià expect 12º or better · Ahora 14º`, and Caja's first season at Sarrià shows gate €3.4M, TV €2M, patrocinio €1.8M against salarios €6.4M for a €933k result. **The appearance is unverified.**

**M0–M5 is complete — the 5.0-shaped game of [ADR 0008](docs/adr/0008-target-pc-futbol-5.md) is done.** Next is **M6**, the living squad: injuries, suspensions, form, morale and training, hung off the day pipeline `advanceDay` was built to grow into.
