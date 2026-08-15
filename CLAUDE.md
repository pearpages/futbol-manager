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
- **Club naming:** a club is its **city** (Madrid, Barcelona, Sevilla). Where a city has more than one club in a division, the second takes its district or ground — Manzanares, Heliópolis, Sarrià, Vallecas — never a crowd nickname, which reads wrong in a table. A city name is not a club trademark; real club names stay a user-supplied import. Follow this when adding a second division rather than inventing composites. **Player** names: the twenty opening squads are shaped on real ones with **every surname altered**, which overrides ADR 0007's fourth decision — see [ADR 0010](docs/adr/0010-real-squad-shapes.md), which records the exposure that accepts. Everyone generated afterwards — youth intake, free agents — still comes from the Spanish given-name and surname pools. The **club** half of the rule is untouched and is still a legal constraint: a city is not a trademark, a crest is.
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

**Sorting is deliberately local to `MarketScreen`**, not promoted to `chrome.css`: it is the first sortable table, and the house rule graduates a primitive on its _second_ use. — _Superseded 2026-08-15: it graduated to `.data-table__sort` in `chrome.css` when the classification, the squad and the club picker became the second use. See the entry at the foot of this file._

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

### 2026-08-14 — three languages, and a cog where the news was

**The app was bilingual by accident.** Navigation was Spanish (`Clasificación`, `Volver`, `Grabar`), body copy was English (`Starting XI`, `Advance day`, every notification), and Caja managed both in one table — `Gate · Televisión · Patrocinio · Salarios`. Nobody chose that; it accumulated a milestone at a time. Measured before starting: **295 string occurrences, ~253 distinct**, plus eight attribute names and ~28 refusals living in `domain`.

**Done.** Catalan, Spanish and English, switchable from a cog in the top corner. **Catalan is the default.** The Noticias button, its badge and its drawer are gone with everything behind them. 514 tests, `pnpm season` byte-identical to `7282b36`, no domain behaviour change.

**No i18n dependency.** `stack.md` is emphatic and a flat dictionary with `{name}` substitution is forty lines — the same call as hand-writing `sfc32`. `i18n/index.ts` plus three dictionaries and `useT()`.

**Keys are the source of truth, not English.** Using the English sentence as the key looks tidier and rots the first time the wording changes. **`dictionaries.test.ts` is the guard that makes three languages maintainable** — identical key sets _in both directions_, no blanks, and **the same `{parameters}` in every language**, because a `{player}` translated to `{jugador}` renders the brace literally on a screen nobody opened.

**Every sentence is whole; nothing is assembled from fragments.** The feed used to pick a verb — `Beat` / `Lost to` / `Drew with` — and glue it in front of the opponent and the score. That works in English and nowhere else: Catalan and Spanish put the result first and the club behind a preposition. Same for `(H)`/`(A)`, which abbreviate _English words_ — Catalan wants `(L)`/`(V)`, Spanish `(C)`/`(F)`.

**The reducer throws codes and keeps its English sentence.** `GameError` carries `code` and `params`; `message` is byte-for-byte what it always was. That bought three things at once: the app translates from the code, anything untranslated still says something sensible, and **all ~12 tests matching on error text passed unchanged** — the whole conversion was additive. Only the ~28 reachable refusals in `reduce.ts` converted; the invariant throws elsewhere are bugs nobody is shown.

**`formatMoney` was the bigger problem than the errors, and it was not obvious.** It hard-coded `€` as a _prefix_, a `.` decimal via `toFixed`, and a `/\.0$/` regex that assumed the separator — across ~25 call sites. Catalan and Spanish postfix: **`12,4 M€`, not `€12.4M`.** `domain` still decides the _unit_ (its own comment argues that correctly) and `i18n/format.ts` decides the presentation. `toLocaleString('en')` was hard-coded in four places, forcing `45,000` where ca/es want `45.000`.

**Dates are numeric, deliberately.** `formatDate` was already locale-free ISO, and `toCivil` hands back `{y,m,d}` — so `15/08/2026` for ca/es costs nothing, where month names would have been **thirty-six more entries to say what two slashes already say**.

**Language lives in `localStorage`, not the save.** It is a third category the store did not have: `game` belongs to a career and is saved, `screen`/`feed` belong to a sitting and are not, a language belongs to the **player across every career**. In the envelope it would mean deleting a career reset your language, importing a friend's save changed it, and a migration for a value with no bearing on the rules — and `loadGame` being async would guarantee a flash of the wrong language before first paint.

**The removal was total.** `unread` became write-only the moment the badge went, so the whole chain went with it — the field, its five reset sites, `markRead`, and `countNotable`, whose only production caller was the store. `grep` for `shell__news|shell__badge|shell__drawer|unread|markRead|countNotable` returns nothing. **The hub keeps its own Noticias panel**, which is where you actually read the news, since every tick of the clock routes you past it.

**35 test call sites hard-coded Spanish tile labels.** Retyping them in Catalan would have broken again on the next wording change, so **each `Tile` gained a `key` and `openScreen` takes that**, resolving through the same dictionary the UI renders from — the same move the quadrants got at M5b. `back()` and `ADVANCE` resolve the same way.

**The suite runs pinned to English** (`test-setup.ts`), which is the same discipline as pinning the rng seed: a behaviour test that is also a translation test fails twice for one reason and tells you neither. `dictionaries.test.ts` covers the other two and `language.test.tsx` covers the switching.

**Two collisions worth knowing.** `nav.caja` was 'Finances' in English and so was its own quadrant heading — renamed to 'Accounts'. And `App.test.tsx` broke on `/Squad/i` matching _two_ headings, because the bar title and the screen heading are now the same English word where they were `Plantilla` and `Squad` before; the query is scoped to `.shell__stage`.

**Club and competition names are not translated.** Clubs are their cities per ADR 0007 and `Girona`/`Sarrià` are already the local forms; `Competition.name` is baked into every save through `GameState`, so changing it is a migration rather than a render.

**Still not seen in a browser** — tenth failed extension connection. Verified by 514 tests and a DOM dump of all three: `Jornada 1 · 14è | Menú Mànager | 15/08/2026 · Següent contra Valencia (V)`, `Jornada 1 · 14º | Menú Manager`, `Matchday 1 · 14th | Menu Manager | 2026-08-15`. Budgets read `5,7 M€` in ca/es and `€5.7M` in en.

### 2026-08-14 — real grounds

**Capacity was a curve on rating and is now literal data.** `seedCapacity` put **1.20M seats in a league that has 776k**, made the Bernabéu 45% bigger than it is, and — the part that mattered more — made a ground a second copy of the squad. Every club now carries the real seat count of the ground its city plays at, as a sixth column in `CLUBS` (`@fm/data`) mirrored row for row into `test-clubs.ts`. `seedCapacity`, `BASE_CAPACITY` and `CAPACITY_EXPONENT` are deleted; `migrations.ts` already froze its own copy of the old curve, so no save was disturbed and **`SCHEMA_VERSION` stays at 8**. 514 tests, `pnpm season` **byte-identical to `76a8518`**, every M2/M3 band untouched.

**Two lists, one league — change one and change the other.** `domain` cannot import `@fm/data`, so `TEST_CLUBS` duplicates the twenty rows, and _every_ harness band runs on that copy. Changing only `@fm/data` would have left the economy criterion measuring a league the game no longer ships. This is the same duplication `seedBudget` already had; both comments now say so.

**The seat cut is not uniform, and that is the whole point.** It falls hardest on the middle — Girona −71%, Vallecas −60%, Getafe −59% — and barely touches the tail, because real grounds do not track rating. **Heliópolis (rated 66.5) is bigger than Sevilla (75); Vigo has 70% more seats than Girona at the same rating.** Those inversions are copied deliberately. A ground is the one thing about a club that is inherited rather than earned, which is exactly what makes the gate interesting; do not "fix" them and do not re-derive the column.

**`FINANCE.TICKET` doubled, 0.0069 → 0.0138 (€6.90 → €13.80), and it was the only knob touched.** Two clubs entered a permanent debt spiral: income below the wage bill, 12% interest compounding, and a squad degrading too slowly to catch up. `c11` reached **−2.65× its overdraft limit** and never came back inside ten seasons. **Restoring the league's _aggregate_ gate income (1.54×) did not fix it** — measured, and it still breached six times — because its own ground fell 71% against the league's 35%. At 2× both arms clear with the worst club at 0.17× its limit, and the league total lands at **2.30× over fifty seasons against 2.15× before**: `WAGE_INFLATION` taxes the extra income straight back, which is the M5a brake doing exactly what it was built for.

**The diagnosis rule that saved time here: measure both arms before touching anything.** The failure surfaced in the _human_ harness, which looks like a human problem. It was not — the standing-still arm broke worse (−3.43× against −2.65×). Two lines of instrumentation ruled out the whole shopping subsystem.

**The M4b harness now manages `c13`, not `c14`, and this is a change to the experiment rather than to the model.** Its subject was chosen mid-table _by rating_, which while capacity was a curve also meant mid-table by wealth. Real grounds broke that equivalence: `c14` has the **ninth-biggest stadium behind the fourteenth-best squad**, the most over-housed club in the division, and so the most to gain from a market its rivals cannot enter. It measured **+10.6 points against a ceiling of 10** — while `c10`, `c12` and `c13` read **+8.1, +7.0 and +8.4** on an identical control arm. The evidence that the model is fine and the subject was not: **the standing-still arm is flat at 44.2–44.5 across every ticket price tested**, so this is not M4c's trap of a degrading control. `c13` is the closest the division has to proportionate — thirteenth by rating, eleventh by seats.

**Numbers a screen now shows** (fresh career, 40 days in): Girona `Capacity 14,624 · Occupancy 54% · Per match €108k · Season €2.1M`; Madrid `83,186 · 98% · €1.1M · €21.4M`; Sarrià `38,529 · 56% · €298k · €5.7M`. Gate spread is 9× top to bottom where the curve gave 4.8×. Madrid sits on `MAX_OCCUPANCY`, which is right for a club that sells out.

**Still not seen in a browser** — eleventh failed extension connection; `list_connected_browsers` returned empty. Verified by 514 tests and a DOM dump of Estadio and Caja at three clubs.

### 2026-08-14 — the transfer you could not close

**Found by playing, not by testing, and the test suite was green the whole time.** Two live bids in `Les teves ofertes`, one with the fee already agreed, and pressing **Obrir** did nothing. 519 tests now, `pnpm season` byte-identical, **no domain change** — every defect here was in the app.

**The bug was layout.** `.market-screen__side` is its own scroll container and the rail has grown to five stacked panels; `NegotiationPanel` mounts near the **top** of it while `Your bids` — the only way to pick an agreed fee back up — is at the **bottom**. Pressing Open set the target, the panel appeared above the viewport, the scroll offset did not move, and the content below shifted down. From the manager's chair the button was dead and the transfer could never be completed. The panel now scrolls itself into view on the target changing, and the bid row carries `is-active` so the press has an answer where it was made even if the panel does not land.

**Three more defects sat behind it, each of which independently reads as "the button did nothing".** This is the M4c pattern again — a feature that looks finished, with green tests, hiding a stack:

- **`NegotiationPanel` had no `key`.** Its fee, wage and years are `useState` initialisers, which run once; switching from one bid to another reused the instance and left the _previous_ player's numbers in the fields. Measured: opening the second man showed a wage of 449 where he wanted 278. Offering a wage below what someone wants is refused with the state untouched — so the deal silently would not close. **A prefill-then-edit field is a remount, not an effect.**
- **A refused offer said nothing at all.** `offerContract` returns `TermsRejected` and leaves the state alone (a refusal is an outcome, not a mistake), while `attempt` only ever reported _throws_. The feed carried the sentence, but **the shell's news drawer was removed at `76a8518` and the hub's panel is a screen away from the press.** `dispatch` now returns the events it already had, and the screen reuses `describe` from `notifications.ts` rather than writing a second sentence for the same event. **Worth generalising: removing the global drawer silently orphaned every non-throwing outcome. Any screen that dispatches a command which can be _accepted but unsuccessful_ has to say so itself now.**
- **Open could be a genuine no-op.** `selected` was looked up in `listingsFor`, which is rebuilt from each club's _live_ `surplus` — and a bid outlives its listing, since buying one player from a club can take the rest of its squad below the spare threshold. The panel then never rendered. It now falls back to the bid, which already carries the player, the seller and the fee.

And `Open` at the outbox was the last untranslated string on the screen; `market.openNegotiation` had existed in all three dictionaries since the i18n pass with **no call site** — `dictionaries.test.ts` enforces key parity across languages, which cannot see a key nobody uses.

**Each new test was checked against the unfixed code rather than assumed to bite** — a test written after a fix passes for free. All four fail without their fix, and the delisted-player one fails with `Unable to find heading "Gonzalo Lara"`, which is exactly the reported symptom. The "carries no numbers over" test also guards its own guard: if both men happened to want the same wage it would pass while proving nothing.

**`Element.prototype.scrollIntoView` is shimmed in `test-setup.ts`.** jsdom has no layout and does not implement scrolling at all — not even as a no-op — so a screen that scrolls would throw in tests for a reason the product does not have.

**Still not seen in a browser** — twelfth failed extension connection; `list_connected_browsers` returned `[]`. **The appearance is unverified:** nothing here proves the scroll lands somewhere sensible on a short window, or that the `is-active` band reads against the screen material.

### 2026-08-14 — the ficha grows a radar, a rival, and an explanation

**Prompted by "the diagrams modern games use are different now"** — and the more useful half turned out to be the second ask: say, on the page, which attributes count for what. 547 tests, `pnpm season` **byte-identical to `1ef1470`**, every M2/M3/M5 band untouched, `SCHEMA_VERSION` still 8.

**Three things, in the order a manager asks them.** An **octagon radar** of the eight attributes, because a silhouette says in one look what a list of numbers does not. A **comparison** — any player from your own squad laid over the same axes, with his number and a signed delta on every bar. And **what any of it means**, as a block under the card.

**Every percentage on that block is read from the constants the resolver runs on.** Restating `0.35` as prose in a dictionary is a second copy of a calibrated model, wrong the first time anyone touches `POSITION_WEIGHTS`, so the ficha imports the weights instead. That needed `domain` to stop hiding them: `ATTACK_WEIGHTS` / `DEFENCE_WEIGHTS` were literals inside `playerAttack` / `playerDefence`, and `ATTACK_SHARE` / `DEFENCE_SHARE` / `KEEPER_WEIGHT` were module-private.

**The refactor is bit-identical, and that was the acceptance test, not a hope.** Iterating a record in declaration order and accumulating left to right is exactly the association the old expressions had, so the floating-point sum cannot move — `pnpm season` proves it. `lineup.test.ts` now carries the arithmetic the functions used to spell out, over four probe players, so the display and the model cannot drift apart silently.

**New in `domain`: `positionShare(position, formation)`** — the share of each team number one player in a slot owns. It is the same weighted mean `teamRating` computes, read backwards, and it belongs beside it rather than in a screen. **Its test reproduces the published table in `docs/attribute-model.md`** (GK 35% / DF 41% / MF 21% / FW 3% of defence in a 4-4-2; FW 61% of attack in a 4-3-3; DF 48% of defence in a 5-3-2) — a doc-versus-code guard the project did not have. A forward's card now reads **22.7% of the attack and 1.5% of the defence**, and a keeper's **35% of the defence on his own, more than any other single player**, which is the model's least obvious and most load-bearing property finally said out loud.

**What the block deliberately does not show is what this player would add to _your_ XI.** That number is `needFor`, and it came off the market screen on 2026-08-14 because it turns buying into a lookup — read the top row, sign him. What is on the ficha describes the **model**, identical for every player in a position. Do not reintroduce it here.

**The resolver sentence asks the resolver.** "Ten rating points of advantage is worth about 27% more goals" is computed by calling `expectedGoals` on two synthetic `TeamRating`s ten points apart, so it re-derives itself if `MODEL` ever moves rather than becoming a lie in a dictionary.

**Geometry in `radar.ts`, colour in `radar.css`** — the `badges.ts` split verbatim, and a test enforces it by reading both files: no hex literal in either `.ts`/`.tsx`, and both series declared as tokens. A polygon's `points` is geometry, not a `style` prop, so the styling convention is untouched.

**`--fm-series-a` / `--fm-series-b` are tokens, not properties on `.radar`.** Written on the chart first, which looked right and was wrong: the attribute rows ink their numbers to match the two shapes and are **siblings** of the SVG, so they inherited nothing. Worth remembering — a custom property shared by two elements that are not ancestor and descendant belongs in `tokens.css`.

**`.select` graduated to `chrome.css`**, the compare picker being the second one after `LineupScreen`'s; `.lineup-row__select` keeps only its `max-width`, which is the row's layout rather than a select's appearance.

**Two defects the DOM dump caught that reasoning had not**, both in the model block:

- A keeper's Team-attack group said "a goalkeeper adds nothing to the attack" and then **listed all eight attributes as counting for nothing** — the same thing twice, at length. The unused line now only appears against an actual list.
- The line read "Worth nothing **at his position**", which is plainly false under _Team defence_: a forward's finishing is worth a great deal at his position, just not to that rating. It is "Counts for nothing here" in all three languages now.

**A test that did not bite, and why it matters.** "A comparison does not follow you onto the next card" passed with the guard removed, because the only route between two fichas goes out through `inspect(null)`, which clears it anyway. The guard inside `inspect(id)` is for the first ficha-to-ficha link, which does not exist yet — so it is driven at the store rather than through the DOM, and **that** version fails without it. Every new test here was checked against the unbuilt code; two were rewritten when they turned out to prove nothing.

**`formatPercent` is new in `i18n/format.ts`** — `22.7%` in English, `22,7 %` in ca/es. The same presentation split `formatMoney` already owns; there was no formatter for it, and one decimal is needed because a forward's share of the defence rounds to nothing whole.

**Still not seen in a browser** — thirteenth failed extension connection; `list_connected_browsers` returned `[]`. Verified by 547 tests and a rendered-DOM dump of a keeper and of a forward compared against his understudy (`+5 / 0 / +9 / +4 / +8 / +14 / −11 / +2` across the eight rows, correctly signed and coloured). **The appearance is unverified:** nothing here proves eight labels fit an octagon at 7px, that gold separates from blue on the dark screen, or that the three model groups sit well at 60rem.

### 2026-08-15 — the corner stops telling the time, and **the game is finally seen in a browser**

**Fourteenth attempt at the Chrome extension, and the first that connected.** Everything below the first paragraph was verified by driving the real app, not by a DOM dump — which is a first for this project, and the reason this entry can say the appearance is right rather than unverified.

**The bar's right corner is now the transfer window and nothing else.** The date and the next fixture were deleted from it. They were a weaker second copy: `HubScreen` already renders the date (`hub__date`) and the whole **Proper partit** panel with the opponent, his badge, the countdown _and_ the controls that act on it — and since `76a8518` the hub is the only place the day can be advanced, so **every tick routes you past the real ones**. The `shell__next` comment defending it ("sleepwalking past your own fixture was the whole complaint") stayed true without the bar's copy; that complaint is answered by where the day controls live, not by the badge.

**What went in its place is the one deadline the game enforces and never announced.** `isTransferWindowOpen` has been a pure predicate over the date since M4b with **no event on either side of it**, so the only way to learn the market had opened was to walk to `MarketScreen` and read a stat — which is to say, by already suspecting. Now `TransferWindowChanged` is emitted, the feed carries a sentence each way, and the corner carries `Mercat obert` **only while it is open**. A badge that is always there is furniture.

**The trap this feature is built around, and the reason it is wired in two places.** The window is a _predicate_, so an opening is a **change across two dates**, and the two date-moving paths are not equivalent:

- `advanceDay` crosses 31 Aug → 1 Sep, 31 Dec → 1 Jan and 31 Jan → 1 Feb.
- **`startNewSeason` jumps from the end of a season straight to 15 August, stepping clean over July** — so the summer opening is _only ever_ reachable there.

Watching the tick alone would have announced January every year and never a summer. **This is M4c's `toCivil(today).d === 1` bug wearing different clothes** — the same "1 July and 1 August are never reached" fact, arriving a second time by a different route. `transferWindowChange(from, to)` in `market.ts` is the shared predicate; both call sites push from it, and each has a test that fails when only that site is removed.

**Verified in the browser across a full career**, Sarrià, one season and into the next: badge clears on **01/09/2026** with _"El mercat de fitxatges s'ha tancat."_; returns **01/01/2027**; clears **01/02/2027**; and returns **15/08/2027 via the rollover** — the case the day clock cannot reach, confirmed with the rollover flag set. All three languages read correctly in the corner (`Mercat obert` / `Mercado abierto` / `Transfer window open`).

**A dead-key sweep came free with it.** Removing the next-fixture block orphaned `shell.next`, `shell.today` and `shell.inDays` in all three dictionaries — the hub has always used its own `hub.*` set. Deleted. **`dictionaries.test.ts` enforces key _parity_ and cannot see a key nobody uses**, which is exactly how `market.openNegotiation` sat unused from the i18n pass until the negotiation bug found it. Worth a periodic grep; parity is not coverage.

**The safety nets fired as designed, again.** `notifications.ts`'s exhaustive switch refused to compile until `TransferWindowChanged` was handled. Every existing event assertion in the suite is type-filtered, so a new union member perturbed none of them.

**No rng was drawn, and that is the whole reason this was cheap.** Events are not state and are not persisted: `SCHEMA_VERSION` stays at **8**, no migration, no fixture, and `pnpm season` is **byte-identical to `1ef1470`**. Same discipline as M3c's `tempo` vanishing at balanced tactics and M4b's bid subsystem drawing nothing — extend a calibrated model only in ways that are inert when the new feature is unused.

**Every new test was checked against the unbuilt code**, and the two that matter were checked _independently_: breaking the tick emission leaves the rollover test green and vice versa. The badge test was also checked against an unconditional badge, so its second arm genuinely constrains the condition rather than passing on the first.

556 tests, typecheck / lint / format clean.

**One wart this did not touch:** `TableScreen`'s "Matchday" stat is `ceil(played / 10)` — _rounds completed_ — while the bar shows the round you are _about to play_, so the two still disagree by one for most of a season. Flagged in the 2026-08-14 title-bar entry, still a one-line fix, still not what the session was asked for.

### 2026-08-15 — the economy, made legible

**Prompted by four questions off one screenshot of Caja, and every one turned out to be a presentation gap rather than a model bug.** The numbers on that screen were all arithmetically right. Nothing about the economy changed; `pnpm season` is byte-identical to `f8d7a65`.

- **"How come there are `primas de fichaje` if we didn't allow them?"** They were allowed, at M5a. 10% of the fee, charged to the buyer, and `affordable` in the reducer has always counted it — so the only ways to learn it existed were to be refused a bid, or to read it off the accounts a week later as a line you had not agreed to. **The bid panel now states the bonus and the total before you commit.**
- **"How come I have `descubierto` −9.7M?"** That was the overdraft **limit**, printed as a negative beside a balance in credit. It is headroom, and it read as debt to the only person it was for. Now `Saldo` · `Disponible` · `Límite de descubierto`, all positive, with a test asserting the panel contains no negative figure while the club is in credit.
- **"Where can I see the salaries of the players?"** Nowhere — `contract.wage` and `contract.until` were rendered for no owned player on any screen, so a wage bill was attributable to nobody. Both are now columns on Plantilla and fields on the ficha.
- **"Are we getting any TV, premios?"** Yes; every €0k was a cadence nobody had stated. New **`seasonProjection`** in `finance.ts`, surfaced as a `Previsión` panel.

**`seasonProjection` must not reuse `annualIncome`, and the comment says so.** That function deliberately prices the gate at the league default and assumes a mid-table finish, because it sizes the overdraft and a manager must not widen his own borrowing with the ticket slider. **A forecast has the opposite duty** — his price, his position, or it is not telling him anything. There is a test that moves the slider and asserts the forecast moves while `debtLimit` does not.

**It is a run rate, not "banked plus remaining".** The question is "can I afford this squad", which is a whole year of income against a whole year of wages; mixing actuals in would make the figure lurch every home match and mean something different in May than in August, when the accounts table beside it already states actuals. Every nullable position is handled by the convention that already existed — `occupancy` drops the form term, `tvMoney` pays the flat share — and only prize money needed a fallback, which is the same mid-table assumption `annualIncome` makes.

**`signingOutlay` exists because two places have to agree.** The market's "Within budget" filter compared the bare fee against the bare balance, which was wrong twice: blind to the bonus, so it offered deals `MakeBid` then refused; and blind to the overdraft, so it hid every player the club could legally borrow for. It now asks the reducer's own question. `affordable` in `reduce.ts` was rewritten to call the same function rather than repeat the arithmetic.

**Consequence worth knowing:** at a mid-table club the filter now shows 227 of 228, because with the overdraft it genuinely can reach almost everyone by fee. That is honest rather than useless — the real constraint is wages, and the reducer does not gate on those either (personal terms are a separate negotiation). **Making the screen stricter than the reducer would reintroduce the same mismatch in the other direction.** The market rail now shows `Disponible` beside `Presupuesto`, because the balance alone contradicts the filter next to it.

**Seen in a browser, for the first time in this project.** The extension connected. That is what caught the one real defect: with three stats where there were two, `Saldo 5,7 M€` broke across two lines in an 18rem rail. `.caja-screen__stats` wraps the blocks now and `.caja-screen__figure` is `nowrap` — wrap the block, never the figure. Sarrià's forecast reads gate €6.3M, TV €3.9M, patrocinio €2.4M, premios €1.1M against salarios €8.5M for **€5.2M**, and Plantilla lists a squad from €105k to €777k adding to the €8.5M the panel states.

569 tests, typecheck / lint / format clean. Schema untouched — nothing here is state, so there is no migration.

**A process note worth not repeating: I ran `git stash push` to compare against HEAD and stashed my own work.** It popped back cleanly and nothing was lost, but `git stash` is the wrong tool while another session is committing to the same tree. **Use `git worktree add --detach <dir> HEAD`** — that is how the `pnpm season` byte-identity check was eventually done, and it touches nothing.

### 2026-08-15 — four people on the hub

**The hub had taken half the reference and left the other half behind.** M5b copied the section _colour_ from `assets/pcfutbol-5.0/hub-menu-manager.jpg` and added twelve flat glyphs; what it skipped is that every quadrant in that screenshot is an illustrated vignette, and two of the four carry **human figures** — suited agents in Mercado, a boardroom in Finanzas. Each section now has a person standing at its foot: **assistant** (Seguiment), **trainer** (Entrenador), **agent** (Mercat), **director** (Finances). 609 tests, `pnpm season` byte-identical to `f908be2`, no domain change, `SCHEMA_VERSION` still 8.

**Pixel art as SVG rects, authored as a text grid.** `sprites.ts` holds four 28 × 32 blocks of characters, one per pixel, decoded into `<rect>`s grouped by ink role; `styles/hub-figures.css` holds the colour. That is the `badges.ts` / `radar.ts` split verbatim, and it is the right shape here because **a pixel grid _is_ geometry**. Rects rather than a bitmap is not taste: they scale as vectors, so there is no `image-rendering: pixelated` and no half-pixel seam at non-integer scales — and it preserves this repo's rather nice property of having **no binary asset tracked anywhere**, not one image, font or favicon.

**Inks are roles, never colours** — `garment`, not `green` — which is what lets four people share one grid vocabulary. Each figure declares five base colours and no more: `--sprite-shade` and `--sprite-seam` are `color-mix`ed from the skin and the garment. Same lesson the badge rim paid for, and the guard is a test that a derived value must contain `var(--sprite-…)` rather than a literal.

**The palettes are independent of `--quad-face`, deliberately.** A person is not a tint of his department and a skin tone is not derivable from a section hue. The constraint they _do_ all answer to: these sit on the near-black `.screen`, so **a charcoal suit would have no silhouette**. The two suited figures take a mid slate and a warm grey-brown over light shirts. Darkening any of them is how you make a figure disappear.

**It costs no layout height.** `.hub` is `height: 100%` over two `1fr` rows and a quadrant holds a heading plus three tiles, so the slack below the tiles already existed — `.hub__quadrant` became a flex column and the figure takes it with `margin-top: auto`. Below `68rem` the rows go `auto`, that slack is gone, and the figures are `display: none` rather than making the hub taller.

**Two things the drawing got wrong, and only looking could find them.** The extension would not connect (fifteenth failure — `list_connected_browsers` returned a browser, then `[]` one call later), so the figures were **rasterised straight from `sprites.ts` to a PNG by a throwaway script in the scratchpad**, reading the real grids and the real stylesheet. Worth reaching for again: it verifies the art without the app, and it is the only reason this entry is not another "appearance unverified".

- **The trainer's whistle could not be made to work, twice.** Two cord strands converging on it rendered as an unmistakable **V-neck sweater**; redrawn as one strand hanging straight down it became a **necktie**. At this size _anything_ on the centre of the chest is read as clothing, because that is what is normally there. He has a **ball at his feet** now — off the body, on the same ground line as his shoes, and the only prop in the set that cannot be mistaken for something he is wearing.
- All four had the same 3px mouth, which renders as four identical moustaches. Three are 2px now; the director keeps his, which is most of what makes him read as the older man.

**Every new test was checked against the unbuilt code, and one earned its keep immediately.** Breaking the run-merge left the round-trip test _green_ — one rect per pixel round-trips perfectly — and only the guard-on-the-guard (`rects < pixels / 3`) fired. A round-trip test alone would have proved nothing about the merge it exists to protect.

**`aria-hidden` on every figure is load-bearing, same as the tile icons.** Two dozen assertions across five files resolve a tile by its exact accessible name. The figure sits outside the `<button>` so it could not rename one — the test is there to prove it did not. And because these are decoration, **the whole change needed no dictionary entry in any of the three languages**, which is the unusual case worth noting.

### 2026-08-15 — the corner counts down

**Prompted by a question, not a plan: "is it possible to know how many days left of transfer are there?"** The badge said the window was open and not for how long, which is half a deadline — you can see that you may buy, but not that you have three days to do it. 615 tests, `pnpm season` byte-identical, no domain behaviour change beyond one new event.

**`transferWindowDaysLeft(date)` is derived, because the window has no stored end.** It is a predicate over the month, so the deadline is the first day of the month _after the window's last month_ — 1 September for the summer window, 1 February for the winter one. Null is the shut state, which means the app asks one question where it used to ask two: `daysLeft !== null` **is** the open test, and `App.tsx` no longer imports `isTransferWindowOpen` at all.

**The trap, and it is a genuinely nasty one: July and August are one window.** A July date must count to 1 September — **1 July is 62 days out, not 31**. "The month after this month" is the obvious rule, it is wrong, and it is right in every other case, because _the day clock never enters July_ (the rollover jumps it). So nothing in a normal career would ever have exposed it. It has its own test, and that test is the only one that fails when the naive rule is substituted.

**This is the third time this project has been bitten by the same fact.** M4c's `toCivil(today).d === 1` never fired for 1 July or 1 August; yesterday's `TransferWindowChanged` needed a second emission site in `startNewSeason` for the same reason; and now the countdown. **The clock enters every season on 15 August and `StartNewSeason` jumps to the next 15 August — write anything keyed on July and check it by hand, because no career will check it for you.**

**`daysBetween` finally has a production call site.** It has existed in `time.ts` since M1 with nothing but tests calling it. Used here rather than the raw subtraction `matchday.ts:41` does.

**The warning fires on exact equality, and that is the mechanism, not a detail.** `left === WINDOW_WARNING_DAYS` in `advanceDay`: the tick moves one day, so the count passes through 7 exactly once per window. **`<=` would report the deadline every day for a week**, which is precisely the shape of feed the notification layer exists to prevent — and the once-per-window test is the one that fails when you write it that way. It is also correctly silent at the rollover, which lands on 15 August with the whole window ahead of it.

**`shell.windowOpen` stopped being a flat key and became a `.one`/`.other` pair.** Not decoration: on 31 August the badge reads **`Mercat obert · 1 dia`**, and a `{days}` parameter would have printed "1 dies" in the one place a player is most likely to be looking. Same for the warning — **`news.windowClosing` takes `{count}` rather than saying "a week"**, so `WINDOW_WARNING_DAYS` can move without leaving three dictionaries lying about it. Prose that names a number a constant also names is drift waiting to happen.

**Measured, all three languages** (`scripts` throwaway, not kept): 15/08 `Mercat obert · 17 dies` → 25/08 `· 7 dies` with the single warning _"Queden 7 dies de mercat."_ → 31/08 `· 1 dia` → 01/09 gone. Boundaries: 01 Jul **62**, 31 Jul 32, 15 Aug 17, 31 Aug 1, 01 Sep `null`, 01 Jan 31, 31 Jan 1.

**Both emission rules were checked by breaking them independently** — the naive month rule fails only the July test, the `<=` variant fails only the once-per-window test. The App test asserts the number **falling** (17 → 16 → 15 → 14) rather than one static figure, because a hardcoded string would satisfy a single assertion perfectly.

**Not seen in a browser this time** — the extension connected for yesterday's entry and was gone again by this one (`list_connected_browsers` → `[]`), so the figures above are a headless dump. **The appearance is unverified:** nothing here proves `Transfer window open · 17 days` fits the corner beside the cog at the narrow breakpoint, and English is the longest of the three.

### 2026-08-15 (b) — the form strip

**Five squares under the hub's `DATA` / `PRESSUPOST` row**: green won, blue drew, red lost, grey not yet played, running **oldest → newest** so the most recent result is the rightmost. The hub said who you are, when it is and what you have, and nothing at all about how the team is going — the classification answered that in a table you had to go and read. 624 tests, `pnpm season` byte-identical, no reducer change, no event, no schema bump.

**Built from `game.season.fixtures`, never from the feed — and that is not a preference.** `TableScreen`'s "Últims resultats" reads `feed`, which is session-only and capped at 60 (`store.ts`), cleared on load and on new game. A form strip built the same way would go blank after every save/reload, which is the one place a _form_ guide must not. There is a test that empties the feed and asserts the strip is unmoved.

**`recentResultsFor` is new domain code — nothing existed.** No form, streak or recent-results function anywhere. It lives in `fixtures.ts` beside `nextFixtureFor`, which is its exact mirror image: that one drops played fixtures and takes the earliest, this one keeps them and takes the latest few.

**The perspective flip is the whole risk, and it is the kind that looks fine.** An away 0–2 is a _win_, so `ours`/`theirs` swap on venue. Reading them straight off the score inverts **every away result** — a strip that is wrong exactly half the time and entirely plausible either way, because nobody checks a colour against a scoreline. Two tests fail when the flip is removed, one of them asserting the same fixture is a win for the away club and a loss for the home one.

**`table.ts` does the same flip and was deliberately not refactored to share it.** Its `record`/`tally` are module-private and it feeds every calibrated band in the project; a tidy-up there buys nothing and risks all of it. Duplication was the cheap side of that trade.

**Three colour tokens were added rather than reaching for the band palette.** `tokens.css` says explicitly that band colours are named for the _competition, not the role_ — the earlier `--fm-europe` was ambiguous enough to lose a whole position through the mapping. So writing `--fm-uecl` to mean "won" is precisely the mistake that comment is a monument to. `--fm-win` / `--fm-draw` / `--fm-loss` are aliases onto the existing colours, following the `--fm-series-a: var(--fm-champion)` precedent already in the file. **No new colour was invented.**

**The strip needed exactly one new dictionary key.** `form.notPlayed` for the grey cells; every played square carries the _feed's own sentence_ — `news.won` / `news.lost` / `news.drew` already existed in all three languages with `{opponent}`, `{ours}`, `{theirs}`. One fact, worded once. The cost, accepted: rewording the feed rewords the tooltips.

**Colour is not the only signal**, per the rule stated beside the notice tones — each square carries that sentence as a `title` and as `visually-hidden` text, the same shape `TableScreen`'s position bands use.

**Blanks pad the left, not the right**, so the newest result is always the rightmost cell and the row does not shuffle sideways as a season fills. Moving the blanks to the other end fails exactly one test, which is what that test is for. Measured at Sarrià: `. . . . .` → `. . . . L` → `. . . L D` → `. . L D L` → `. L D L W` → `L D L W D`.

**Not `.swatch`, and not `chrome.css` yet.** The swatch exists so a position band always has a legend and its modifiers are competition names — sharing it would muddy that. The new `.form-strip` lives in `HubScreen.css` because the house rule graduates a primitive on its _second_ use; the classification sidebar is the obvious second customer.

**Not seen in a browser** — the extension connected once yesterday and has been `[]` ever since. Verified by 624 tests and a throwaway rendered-DOM dump. **Unverified:** whether 14px squares read at that size against the dark screen material, and whether green/blue/red separate at a glance for a colour-blind player — the sentences are there for assistive technology but a red/green pair is the classic hazard, and adding a letter to each square would fix it if it turns out to matter. The dump's language arm also did not re-render (no `act`), so ca/es were not seen rendered here; the sentences are covered by `language.test.tsx` and the new key by the dictionaries parity test.

### 2026-08-15 (c) — position moves to the hub, and stops being an ordinal

**Four changes to what the identity panel says.** The form strip is centred and runs **ten** matches; **position moved from the title bar into `.hub__identity`**, between DATA and PRESSUPOST, sized above its neighbours and coloured by qualification band; and **`shell.position` is deleted outright**. 627 tests, `pnpm season` byte-identical, no domain change at all.

**A real bug went out with the key.** English `shell.position` was `'{position}th'`, so first, second and third rendered as **"1th"**, **"2th"**, **"3th"** — in the title bar, on Decisiones and in every board verdict. Deleting the key removed it rather than patching it, which is the better outcome of the two.

**Removing an ordinal is not free, and the prose is where it bites.** Position was not only a _value_: it was interpolated into six sentences. A bare number dropped into the old wording gives `"El Barça espera 6 o millor"` — six points? — and `"Querían 6"`, six of what. So **the sentences were reworded rather than the parameter swapped**: `board.demand`, `hub.dismissed`, the three `news.board*` keys and `caja.projectionNote`, in all three languages. `caja.projectionNote` had the `è`/`º`/`th` **baked into the string literal**, so it could not have been fixed at the call site at all.

**Position on the hub is band-coloured, and `bandFor` graduated to get there.** `Band`/`BANDS`/`bandFor` moved from `TableScreen.tsx` to **`packages/app/src/bands.ts`** — the hub is the second caller, and the alternative was one screen importing from another. Same graduation `shuffle` made from `market.ts` to `rng.ts`. Gold champion, blue for the Champions League places, red in the relegation zone; **mid-table gets the size and no colour, because mid-table is genuinely nothing** — and there is a test asserting that, since a rule painting every position would satisfy the positive case whenever the managed club happened to sit in a band.

**A wart the DOM dump caught and reasoning had not.** The band's `visually-hidden` label sits inside the same span as the number, so the accessible name read **`20Relegated`** — the same defect a disabled hub tile has with its milestone badge (`"CajaM5"`). Fixed with a leading space in the hidden text. Worth knowing: **`visually-hidden` inside a text-bearing element needs its own separator**, because nothing in the DOM supplies one.

**The bar's separators needed no change at all.** Interpuncts are drawn by `.shell__where > * + *::before` — every child _but the first_ — so removing the position leaves no dangling `·`. That is exactly the case the rule's comment was written for, and there is now a test asserting the bar does not end in one.

**Measured at Sarrià over twelve rounds:** the strip fills right-to-left and slides (`. . . . . . . . . L` → `L W D D L D D L W L`), and the position tracks the classification exactly — 18th of 20 with `is-relegation`, confirmed against `computeTable` at the end of the run.

**Two limits worth knowing.** The hub centre column is **18rem**, so three stats plus a ten-square strip is close to the edge: ten pips at 14px with `--fm-space-1` gaps is 176px inside ~256px of usable width, and if a fourth vital ever lands there the gap is what should give, not the position. And the `advanceUntil` guard in the strip test had to go 60 → 120: ten rounds is ~70 ticks, and too low fails as a confusing "still not done after N presses" rather than as a wrong assertion.

**Not seen in a browser** — `list_connected_browsers` empty again. Verified by 627 tests and a throwaway DOM dump. **Unverified:** whether three vitals actually fit 18rem at the rendered font sizes without wrapping, and whether `--fm-text-lg` reads as "highlighted" beside two `--fm-text-md` neighbours.

### 2026-08-15 (d) — the roadmap catches up with the code

**No code changed. `docs/roadmap.md` and this file only** — 627 tests, typecheck / lint / format untouched and green, schema still 8.

**The finding that prompted the rest: the roadmap silently stopped being the plan.** It was last touched at `f6ce106` (M5b). Since then **nine commits landed +6,746 / −936 lines across 74 files — about 30% of the codebase — and advanced no milestone at all**, while `docs/` received **zero** changes and this session log grew by 242 lines. **81% of those insertions (5,495) are in `packages/app`.** Roughly 19 of the log's 24 entries describe work the roadmap never mentions.

**That is not scope creep into M6.** It is a real, unplanned polish phase — badges, the hub, the radar ficha, real capacities, the window countdown, the form strip, three languages — and it is now written into the roadmap as **"Between M5 and M6 — the polish phase"** rather than left as an unexplained two-day gap. The section keeps the four defects that phase found (the unreachable negotiation panel, the 60-row market cap, "€0k", the overdraft printed as negative) because they share one property worth generalising: **the suite was green through every one of them, and all four were found by playing.**

**Two off-roadmap commitments were accepted and recorded rather than reworked.**

- **Three languages was never planned**, and it is a standing tax rather than a finished job: ~334 keys × 3, and every future screen now costs its markup, its wiring _and_ three dictionary entries per string against a ~40-screen projection. Now a named cross-cutting track, with the gap stated — **`dictionaries.test.ts` enforces parity but cannot see a key nobody uses**, and both orphans so far (`market.openNegotiation`, `shell.next`/`today`/`inDays`) were found by hand. Parity is not coverage.
- **The data pipeline never started.** It was scheduled "starts at M3, ~2 weeks" and `packages/data/` is still three files. Re-pointed at **M7**, which is the first milestone with a consumer — fog-of-war needs a real distribution to be uncertain about. The **`pace` risk moved with it**; pinned to M3 it would have expired silently along with the milestone.

**Three outright errors fixed, all the same class — a doc contradicting a doc:**

- The decision table said ADR 0001 was **npm** workspaces; the ADR is pnpm and was reversed the same day, and line 47 of the same file already said so.
- **ADR 0009 was missing from the table entirely**, though M5a's prose links to it.
- M4a still asserted **"money is conserved… never to be loosened"**, superseded at M5a. Retracted _in place_ — the 27,854k measurement is still true history — rather than deleted.

**One claim checked and found false, which is why it is worth writing down:** an agent reported `market-model.md` carrying the same stale conservation invariant. It does not — line 142 already records the supersession and links ADR 0009. **No edit was made there.** Verify a reported contradiction against the file before fixing it.

**New: a "Known open items" section**, because an append-only log is where a one-line fix goes to be deferred a third time. Both of the small ones had already been deferred twice: the **matchday off-by-one** (`TableScreen.tsx` shows rounds _completed_, the hub shows the round _about to be played_) and the **`"CanteraM7"` accessible name** (one attribute, but a test pins the name as `` `${label}${tile.milestone}` ``, so the test changes with it). Joined by two structural ones that were only ever in prose: the overdraft having no teeth, and **the harness running every club on balanced tactics — so it is blind to exactly the exploit class M3a and M5b both shipped**, a lever whose right answer is an end stop.

**Convention gap this exposed, and the reason the drift happened.** The rule to append a session entry worked perfectly — twenty-four of them. There was no rule to keep the roadmap current, so a stretch with no milestone in it produced no roadmap edit for two days. **A milestone-free stretch still needs a roadmap entry**, or this recurs.

**One thing not fixed, noted so the log is not over-trusted:** `bb6df7a "feat: strike widget"` contains no strike work — it is the form strip plus the hub position change, two separately documented sittings squashed under one wrong name. History left alone.

### 2026-08-15 (d) — the league becomes the real one

**Prompted by a question with two halves, and they landed in very different places:** could club quality be inferred from Transfermarkt, and could squads be lifted with the surnames changed slightly. The first is a straight improvement on a guess and needed no permission. The second overrides a standing ADR, and is recorded in **[ADR 0010](docs/adr/0010-real-squad-shapes.md)** rather than done quietly. 677 tests, `SCHEMA_VERSION` still 8, no migration.

**Both rating columns are now derived, not designed.** `clubs.ts` used to argue for the _shape_ it was imitating — "two or three clubs clear of the rest, a broad middle… and a weak tail" — which was a good guess and wrong in places: it put **Sevilla eight points above Villarreal**, where the real figures are €324.6M against €128.9M. One log mapping over squad market value, anchored so the range is **exactly** what the hand-tuned table spanned (86.5 down to 49.5), so only ordering and spacing moved. **Madrid derives to 88/85 — the hand-tuned figure exactly**, which is the best evidence available that the method is sound.

**The attack/defence split needed centring, and that is the subtle part.** Splitting on the club's own share of squad value in attacking versus defensive positions reads **defensive for all twenty clubs** — a squad holds far more defenders than strikers while a defender counts 0.15 toward attack. That systematic component is an artefact of squad composition, not a fact about anybody; centred on the league mean it becomes real signal. Sevilla 59/64 on a squad with almost no forward value, Getafe 61/55 on four strikers and a thin defence.

**Twenty-five clubs, twenty of which play.** Every existing id is kept — nothing renamed, nothing deleted — so the five relegated clubs (Girona, Almería, Palma, Cádiz, Granada) are still there with updated ratings, and five real ones arrive: **Benicalap** (Valencia's second club, per the district convention), A Coruña, Santander, Elche, Málaga. **`inLeague` lives in the authoring tuple and never on the `Club` entity**, which is the whole reason there is no schema bump: nothing persisted changed, and a save carries its own clubs array. Ground rule 5 holds — no division field, no second competition, no promotion. **Girona would rank twelfth if it played**; the second tier is not uniformly weaker and the real figure says so.

**`pnpm season` is deliberately not byte-identical, and that is the point.** The league changed. The substitute proof is that **every M2/M3/M5 band passed unchanged** — measured over 50 seasons: goals/game **2.62** (was 2.70), home wins **45.3%**, draws **24.0%**, champion **88.8 (75–101)**, 18th **35.4**, spread **60.2**. The band flagged in advance as most at risk — `weakest five mean position > 13` — came in at **15.63**.

**One change of character worth knowing, because no band catches it.** Titles now split **62/26/12 across the top three and nobody else wins in fifty seasons**, where the old league had "a few surprises". That is the data speaking — Manzanares to Villarreal is a 7.5-point cliff because €679M to €325M is a 2× gap — but a league where fourth can never win is a different game from one where it occasionally does. Decide it deliberately if it grates; the lever is the mapping exponent, **never a row**.

**Two tests were passing on luck, and the league change exposed both.** The hub's weak-XI warning swapped _the first_ defender it found for _the first_ reserve — `teamRating` clamps to a whole number, so an adjacent swap can round away to no change. It swaps best-for-worst now and asserts the gap is real. And `market.human.test.ts` assumed its subject club sold somebody: only **8 of 20** clubs attract a buyer in a window, because each club makes one paid signing and every seller competes for those slots. **Checked against HEAD in a worktree before re-picking** — the old league had **6 of 20** selling, so the market got _more_ liquid, not less. `git worktree add --detach`, never `git stash`.

**A dead filter found underneath that.** `'sells nobody you did not list'` excluded youth by `id.includes('-2027-')`, but `generateYouthPlayer` builds `${club.id}-y${year}-${n}` — the `y` sits where that pattern wanted a dash, so it never matched anything. It went unnoticed because the club it managed happened to take no youth intake that season. **A filter that has never fired is not a passing test.**

**Squads: real shape, generated level.** `generateSquad` takes an optional `roster` supplying names, ages, squad size and the order within a position group; `calibrateSquad` still collapses the finished squad onto the club rating, so **the round trip is untouched** — measured at **±1 across all twenty**, inside a ±3 band. That inversion is the whole safety mechanism: letting squad quality float free would put every calibrated band back in play at once. Squad sizes are now **19–29**, ages **17–39**.

**The winger problem, which has no clean answer and needed the ugly one.** 3-5-2 wants five midfielders and 4-3-3 wants three forwards, and **no fixed mapping of Transfermarkt's positions satisfies both** — Barcelona has _nobody_ listed as a striker, while Sevilla and Vigo have only four central midfielders. Wingers are exactly the players who fill either slot, so they are assigned to whichever bank their squad is short of. A squad that cannot field a formation throws out of `bestXI` rather than failing politely, so there is a test per club per formation.

**The harness gap, stated rather than hidden.** `TEST_CLUBS` ships no rosters and `domain` cannot import `@fm/data`, so **every statistical band still runs on generated squads** while the game ships real ones. `packages/data/src/rosters.test.ts` is what pays for that: round trip, formation feasibility, age band, and value ordering. If it proves insufficient the fix is mirroring the rosters into `domain`, the way `TEST_CLUBS` already mirrors `CLUBS`.

**On the surnames, and why the ADR is blunt.** The alteration ran **once, offline; only its output is committed** — shipping the mutation function beside the real list would put the real surnames in the repo, which is the thing it exists to avoid. 427 distinct real surnames produced 427 distinct altered ones, zero colliding with a real one. **That check cannot be a test here**, because re-running it needs the list. ADR 0010 says plainly what this accepts: an altered surname does not remove the identification, the near-miss is easier to read as copying than a generated name would be, and bulk extraction engages the database right independently of the naming question. Reversal is cheap by construction — one file, and the generator already falls back to name pools.

**Not seen in a browser** — `SetupScreen`'s tier thresholds were retuned (80/70/62/55 bucketed the new spread 2/2/4/11/1, which is useless where a player most needs it) and **that retuning is unverified by eye**, as are the five new badges. Blue-and-white is now the crowded palette at four clubs, so the shapes are carrying more than they were.

**Known open items** — unchanged from the previous entry, plus: the harness measures generated squads while the game ships real ones; the title race has no surprises; and the five out-of-league clubs carry no attack/defence split, because no roster was fetched for clubs nothing generates squads for.

### 2026-08-15 (e) — the rating scale becomes PC Fútbol's

**Prompted by playing it: "why are players so bad in general?"** Measured before touching anything, over the 509 shipped players: median **59**, **52.5% below 60**, floor **27**, and **one in three players who actually start a Primera match rating under 60**. Against PC Fútbol, where a Primera squad was mostly 70s with 60 as the floor. The complaint was right and understated. 677 tests, every M2/M3/M5 band green, `SCHEMA_VERSION` still 8.

**Two separate problems were underneath it, and only one was the scale.**

**A position bug, worth more than it looks.** GK averaged 52.3 and DF 55.2 against MF 63.9 and FW 63.7 — only fourteen keepers in the entire league reached 60. `KEY_ATTRIBUTES.DF` was `tackling, heading, pace, stamina` and `DEFENCE_WEIGHTS` is _exactly those four_, so a defender delivered `base + 4` on defence; a midfielder's keys covered 45% of `ATTACK_WEIGHTS` and he delivered `base − 4.8`. Through the shares that left pre-calibration `teamDefence ≈ base + 2.2` against `teamAttack ≈ base − 2.8`, and `calibrateSquad` — which applied `attackGap` to MF/FW and `defenceGap` to GK/DF — dumped the whole discrepancy on the attackers as a bonus. **Measured cumulatively: +6 to MF/FW, −2.5 to GK/DF.** Forwards were inflated; nobody else was broken.

**The trap that cost the most time here, recorded so nobody repeats it: a per-position trim cannot fix that.** Raising a position's base raises its contribution to the team rating, which lowers its own gap by ~76% of the same amount — `trim + gap` is a single quantity pinned by the round trip. Every correction was circular; closing an 8.5-point gap needed a ±20 trim, which clamps at the ceiling and breaks. Two full iterations were spent proving this before the real answer surfaced: **the position split in `calibrateSquad` had to go.** The offset is keyed on the _attribute_ now — `shiftFor` weights it by which axis the attribute serves — so every player at a club takes the same vector and no position can be favoured. Spread **11.87 → 1.12**.

Along the way `KEY_ATTRIBUTES` was rebalanced (which alone took the gap differential 6.15 → 1.35) and `SHAPE` became per-position, solved so `Σ_key · boost = Σ_other · penalty` and a position's `overall` lands _on_ `base`. **Axis-neutrality and overall-neutrality genuinely conflict** — satisfying both forces every attribute to equal `base`, which would delete the "centre-back who cannot finish" texture — so `overall` was chosen and the residual handled in `calibrateSquad`.

**The rescale itself was nearly free, and the reason is worth keeping.** `expectedGoals` reads ratings **exactly once**, as `attacking.attack − defending.defence`, and every weight row sums to exactly 1.00 — `ATTACK_WEIGHTS`, `DEFENCE_WEIGHTS`, every `POSITION_WEIGHTS` row, the share normalisation, and `KEEPER_WEIGHT + (1 − KEEPER_WEIGHT)`. So under `r' = a + b·r` the offset cancels in the subtraction and `b` is absorbed by `MODEL.SCALE`:

```
edge' = ((a + b·A) − (a + b·D)) / (b·SCALE) = (A − D)/SCALE = edge
```

**λ is unchanged, so the league table is unchanged.** A renumbering, not a rebalance. `a = 39.72`, `b = 0.5965`, anchored to put the weakest player on 60 and the best on 94 — the top at 94 rather than 99 deliberately, because `calibrateSquad` needs headroom and Madrid already pushed attributes to 98.

**Result: min 60, median 74, p90 85, max 93, and zero players below 60.** Positions within 1.1 of each other. `pnpm season` reads champion 90, bottom 32, 2.62 goals/game, 44.2% home wins — the same league.

**What the renumbering actually cost was the five absolute anchors**, and they fail silently rather than loudly. `qualityFactor`, `seedBudget` and `sponsorMoney` divided by a hardcoded 50; `occupancy` and `wageDemand` had a _pivot as well as a slope_, so left alone they would not have rescaled but changed behaviour — every club pinning at `MAX_OCCUPANCY`, and `wageDemand`'s `max(0, …)` branch going dead. All five are reparametrised against the same point in the distribution they always used. **Nothing in the suite asserts an absolute price, so none of this would have failed a test.**

**The AI market did quietly stop trading, exactly as predicted — and the cause was not the one expected.** `needFor` subtracted two _rounded_ team ratings, so four thresholds written as 0.25/0.4/0.4/1.5 all collapsed to "≥ 1" or "≥ 2". `teamRatingRaw` returns the pair unrounded and `needFor` scores against that — a separate entry point rather than a field on `TeamRating`, because the first attempt _was_ a field and the extra allocation on every call pushed the tactics harness past its 5s timeout. `teamRating` is hotter than it looks. But the thresholds were fine: **`VALUE_FOR_MONEY` was the problem, and it had to move by far more than `b`** — 0.0016 → 0.0003. It caps what the AI pays per point of improvement and it only ever bought at the cheap end; raising the floor from 27 to 60 _removed the cheap end_. There are no bad players any more, so there are no bargains, and the bottom of the market roughly doubled. Measured: **2 of 158 positive-need candidates still cleared the old figure.**

**Deal volume is the health check, and it is not asserted anywhere.** Clubs selling in a window: **6 of 20** before the Transfermarkt work, **8** after it, **9** now. `market.human.test.ts` had to re-pick its subject a second time for the same reason — which club is in that set is not stable, and its comment now says so rather than pretending otherwise.

**Two of my own mapping slips, both caught by tests.** `resolve.test.ts`'s `WEAK` was set from Málaga's new club figures instead of remapping the test's original 49/50 — a plausible-looking number that quietly widened the strong/weak gap and pushed upsets under the band. And the tactics test's strict inequality now fails at mild slider settings because the penalty is sub-point once the scale compresses and rounds away; it asserts `<=` across the range and `<` at the extremes, which is where the exploit it guards actually lives.

**The screens are where a hard squash genuinely costs something.** With everything in 60–94, anything plotted against 0–100 stops discriminating. Attribute bars and the ficha radar are rebased to a floor of 40 — below the lowest real attribute, so nothing clips and the visible half is the half that varies. `is-strong`/`is-weak` re-cut from 80/40 to 88/62, since an ordinary player would otherwise light up as strong and `is-weak` could never fire. `SetupScreen`'s tiers re-cut to 85/78/74/71 (3/5/7/4/1). The bucket rebasing lives in `PlayerScreen`, **not** in the shared primitive, because `EstadioScreen` fills the same one from an occupancy fraction.

**Known, and accepted with the information in hand:** Málaga's first eleven now reads ~70 rather than looking like a relegation side. The table still separates clubs correctly — results are identical — but the numbers no longer shout it. That was the stated cost of the hard squash over the moderate one.

**Not seen in a browser** — `list_connected_browsers` empty again. **Unverified:** whether the rebased bars and radar actually read at a glance, which is precisely the thing this change most needs eyes on.

### 2026-08-15 (f) — squads stop being twenty identical blocks

**Prompted by looking at the previous entry's result: "you over did it."** The scale was right — bulk in the 70s, worst in the 60s — but the shape inside a squad was wrong, and measuring said so more bluntly than the complaint did. 677 tests, every M2/M3/M5 band green, `SCHEMA_VERSION` still 8.

**The diagnosis, and it is one sentence: every squad in the league was the same ~10-point block translated up or down by the club rating.** Squad spread measured 9–15 points for _every_ club, Barcelona and Málaga alike. So **Madrid's worst player was 81 and Barcelona's 82** — neither club had anyone below 80, and Barcelona's fifteenth-best was an 87. **All 100 of the league's 80+ players sat in three clubs**, leaving seventeen with none. Barcelona had 8 players at 90+, Madrid 6, everyone else zero.

**The cause was that `value` was a sort key and nothing else.** `slotsFor` ordered a position group by market value and then threw the magnitude away, so the gap between a group's best and worst was always exactly `DEPTH_FALLOFF` and the _spacing_ came from **group size**. The cleanest proof: Madrid's two keepers, €15M and €12M, came out **eleven points apart** — because the group had two members and the second one ate the whole falloff — while Barcelona's **€800k third keeper came out an 84**, better than anyone at seventeen clubs. Madrid's €6M Rüdiger out-rated its €20M Militão, because noise swamps a rank-only ordering.

**Three attempts, and the first two are worth recording because each failed in an instructive way.**

- **Spread proportional to the club rating** fixed Madrid's bench (down to 69) and immediately **put thirty players under 60**, because sixteen points below Málaga's 69 is 53. Spread has to scale with `rating − SPREAD_FLOOR`, not with the rating: that gives Madrid more than twice Málaga's range instead of a third more, which is both what keeps the floor and the truer statement.
- **Comparing value only within a position group** then flattened the stars completely — **the league topped out at 90 with three players there**. Every group's best sits at decline zero, so a €200M forward and a fourth-choice centre-back came out level. Cross-position quality was still being discarded.
- **The fix is to divide by the league norm for the position first**, then compare across the whole squad. Both halves are load-bearing: raw squad-wide value rates every keeper as filler because keepers are cheap; group-only comparison cannot tell a star from his own team-mates. `generateLeagueSquads` computes the per-position **median** — mean would be dragged by a handful of €200M forwards — and passes it down. It is the only caller that can see every roster at once.

**Result, against the target agreed beforehand:** min 62, median 73, max 93. **Zero below 60.** Bands 31% / **51%** / 17% / 6 players at 90+ — Madrid 4, Barcelona 2. Madrid's bench now runs 75–90 and Barcelona's 67–86; Villarreal, Bilbao and San Sebastián carry five to eight players in the 80s where they had none. `pnpm season`: champion 94, 2.67 goals/game, 45.5% home wins.

**A second affine remap on the club ratings came with it** (`b₂ = 0.837`, Madrid 91 → 88) because **the club rating _is_ the XI's average**, so nothing else can reduce how many of its starters clear 90. `MODEL.SCALE` 25.05 → 20.96 absorbs it and results are unchanged. **The cost of a second remap is that all five absolute anchors move again** — `RATING_FLOOR`/`RATING_UNIT`, `occupancy`'s pivot and slope, `sponsorMoney`, `wageDemand`, `seedBudget` — plus `SLIDER_SWING`, `NOISE`, `YOUTH_GAP`, `SHAPE`, the four market thresholds and every scale-bound test literal. That churn is the argument for getting the scale right in one go.

**Two tests failed for reasons that were the new behaviour working, not breaking.** `rosters.test.ts` asserted the best-valued player at a position out-rates the worst — but Sevilla's two keepers both cost €3M, so they now come out **identical, which is the point**. It asserts `>=` always and `>` only when one is worth twice the other. And `squad.test.ts`'s specialisation check compared `find`'s first defender's tackling against his finishing: the key-attribute separation is about five points on this scale against ±3 noise, so a single player is a coin toss. It compares position _means_ now, which is the actual claim.

**`market.human.test.ts` re-picked its subject club for the fourth time.** Clubs that sell in a window: 6 → 8 → 9 → **7 of 20**, and _which_ clubs has changed every time. The comment now says to expect re-picking rather than pretending the index is stable; the trend is the health check, and nothing in the suite asserts deal volume.

**Not seen in a browser** — extension still empty. **Unverified:** whether Plantilla now reads as a squad with a top and a tail, which is the whole point of the change.

### 2026-08-15 (e) — every table sorts

**The graduation the codebase had already asked for.** `MarketScreen.css` had carried the instruction since M4b — _"this is the project's first sortable table, and the house rule promotes a primitive on its second use. The next screen that needs sorting is the one that moves it."_ Clasificación, Plantilla and the club picker are that second use, three at once. 698 tests, typecheck / lint / format clean, `SCHEMA_VERSION` still 8.

**`packages/app/src/sorting.ts` + `screens/SortHeader.tsx`**, the logic/presentation split the codebase uses everywhere. A screen supplies **one `value` accessor per column** rather than a comparator, so direction and collation are decided once instead of four times — which is what collapsed the market's `switch` into a lookup and kept the other three screens to a handful of lines each.

**Caja is deliberately not sortable.** Its nine ledger lines are in a meaningful order — income, then outgoings — ending in a pinned `Resultado`, and the forecast panel has no header row at all. Sorting it would say less than it costs.

**No new dictionary keys, and one long-standing orphan finally wired up.** Every column label already existed. `market.column.position|player|club|age|overall|asking|action` had sat fully translated in all three dictionaries with **no call site** since the i18n pass, while the market hardcoded `"Player"`/`"Ovr"`/`"Asking"` in English — the third orphan-key case this log records, and again found by reading rather than by a test. **`dictionaries.test.ts` enforces parity and cannot see a key nobody uses; parity is not coverage.** Headers now read `Jugador | Club | Edat | Mitj | Demanen | Acció` in Catalan.

**Sort the domain's value, never the rendered label.** Catalan `POR/DEF/MIG/DAV` sorts as DAV→DEF→MIG→POR where English `GK/DF/MF/FW` sorts as DF→FW→GK→MF, so a position column keyed on the chip would order the same squad differently in each language. Squad position sorts on `POSITION_ORDER`; Setup's Prospects sorts on the rating `tierFor` itself reads, so the tiers come out contiguous.

**The classification cannot be allowed to lie, and that shaped the data.** A `Standing` carries `{ row, position, band }` decided from `computeTable` **before** anything is reordered, so both describe the club rather than the row. Read off the render index instead, sorting by defeats would show the most-beaten club as 1st wearing the champion's colours. `#` is itself not sortable — the unsorted order _is_ position order, so the control's ascending state would be its own home state.

**The bug this uncovered, which had nothing to do with sorting.** `SquadScreen` computed `spare` from the array it had just sorted. `surplus` runs `bestXI`, `bestXI` orders on `overall` alone, and **`Array.prototype.sort` is stable** — so among players level on overall in a position, whoever comes first in the input takes the shirt. Harmless while the input order was fixed; the moment it is a manager's click, **which players he is allowed to sell changes as he sorts the table.** Measured across the division at the opening seed: **8 of 20 clubs affected**, San Sebastián by four players on a wage sort. `spare` now reads the stored squad. Generalising: any screen that both sorts a list and hands that list to `domain` has turned a rendering choice into a game decision.

**Two tests were written, passed, and proved nothing — both caught by checking them against the unfixed code.** The classification test first sorted by _goals for_, where the leader happened also to be the top scorer, so row 1 was right for the wrong reason; it sorts by **defeats** now and carries a guard asserting the leader actually moved off the top row. The `surplus` test was written at the default mid-table club, whose squad has no tie at an XI boundary. **A test written after a fix passes for free** — every new test here was run against the broken version first, and the two that did not bite were rewritten until they did.

**One claim in the plan was wrong and is corrected rather than shipped.** The market's Club column sorted on `listing.from` — the club **id**, an ASCII slug (`a-coruna` for `A Coruña`). I recorded that as a visible bug; measured, **slug order and name order are identical across all twenty clubs**, so nothing was ever misplaced. The fix stands — a column keyed on something it does not display is fragile, and it bypassed the locale collation this screen threads through — but it is asserted on `listingValue` directly, because an ordering that coincides either way cannot test it.

**Determinism holds by construction, not by diff:** every changed file is under `packages/app`, and `pnpm season` reads only `domain` and `data`.

**Not seen in a browser** — sixteenth failed extension connection; `list_connected_browsers` returned `[]`. Verified by 698 tests and a rendered-DOM dump: sorted by defeats, Málaga sits on the top row reading `#16` with no band while Getafe reads `#18 Relegated`; the squad by wage puts Chopa's €829k first with `#` renumbering 1..N; Setup by defence puts Barcelona's 88 above Madrid's 87. **The appearance is unverified:** nothing here proves the ▾/▴ glyph and the gold `is-active` colour read at `--fm-text-xs` against the dark screen, that a one-character header (`#`, `P`, `W`, `D`, `L`) is a large enough hit target, or that the sticky header still sticks with buttons inside it.

### 2026-08-15 (g) — four more formations, and the shape gets a tempo

**Prompted by "there are way more tactics, which ones would you add?" — which meant formations.** The four shipped shapes cover neither containment, nor an attacking back three, nor a chase-the-game front four. **4-5-1, 5-4-1, 3-4-3 and 4-2-4** now do. 435 domain-side tests, `pnpm season` **byte-identical to `f0530f2`**, `SCHEMA_VERSION` still 8, no migration.

**The structural fact that decides what is even addable: a formation here is _only_ its bank counts.** So 4-2-3-1, 4-1-4-1 and 4-3-2-1 are all DF4/MF5/FW1 — indistinguishable from 4-5-1 — while 4-4-1-1 _is_ 4-4-2 and 4-1-2-3 _is_ 4-3-3. The modern shapes people ask for first are not table entries; they need a fifth bank (DM/AM), which is a change to `Position` itself rippling into generation, `POSITION_WEIGHTS`, `bestXI`, `needFor`, the roster mapping and the ficha. **That absence is period-correct** — 4-2-3-1 belongs to the 2000s — so the three banks cost the 1996/97 target nothing.

**The blocker was in the market, not the lineup, and only measuring found it before the code did.** `canSpare` hand-wrote its floor as `4-4-2 + 1` and `market-model.md` claimed that "happens to satisfy every other formation too". 4-2-4 wants a fourth forward, so the claim went silently false and **19 of 200 squad-seasons could no longer field a shape the screen was offering**. `DEEPEST_BANK` now lives in `lineup.ts`, derived from `FORMATIONS`, and both `canSpare` and `canRelease` read it — `Math.max(DEEPEST_BANK[p], 4-4-2[p] + 1)` keeps the "one cover beyond the XI" intent and changes exactly one number, FW 3→4. **Do the market fix before adding the table entries** or the harness goes red with no obvious cause.

**"Guard the crash" understated it: the disabled button is the cosmetic half.** `bestXI` throws on a short bank, and the reachable throw is `market.ts:453` inside `applyTransfers` — which runs inside `dispatch`, and **there is no `ErrorBoundary` anywhere in the app**. `canField` / `fieldableFormation` fall back to 4-4-2 at both reducer-internal re-pick sites rather than throwing, because `errors.ts` reserves `GameError` for refusals a player is shown and nobody is being refused. `bestXI` still throws: if 4-4-2 itself is unfieldable the squad is broken.

**The rollover guard is defence in depth and the test says so.** Inside `rolloverSeason` a bank cannot actually drop — releases are floored by `canRelease` and a retirement promotes a youth at the same position. The state has to _arrive_ short, which today means a sale and from M6 will mean an injury. My first test for it **passed with the fix removed**, which is the "test that did not bite" shape this log has recorded before; it now builds the short state directly and fails without the guard.

**`FORMATION_TEMPO` is new, and it is the reason the defensive shapes are worth pressing.** Measured first: 4-5-1 averaged **−1.6 points and was optimal at none of the twenty clubs**, 5-4-1 −1.0. Structural, not tuning — `ATTACK_SHARE.MF` 0.45 and `DEFENCE_SHARE.MF` 0.5 make a midfielder a half-contributor to both means, so trading forwards _and_ defenders for midfielders dilutes both. Real football pays for that with tempo control, and formation could not touch tempo. **This is the M3a slider trap in a third costume**, and M3c's fix is the one that applied.

- **The first calibration failed and measuring is what caught it.** At ±0.3 the defensive end was still dominated — 4-5-1 went from −1.6 to **−2.6**, i.e. the term was decoration. At −0.6/−0.7 the best shape runs with strength: Madrid and Villarreal attack, Málaga contains, Getafe is punished either way.
- **The scale is asymmetric on purpose.** An attacking shape is already paid by bank concentration; a defensive one is punished by it and has to clear that debt first. Hence +0.4 against −0.7.
- **The shape is read off the players on the pitch, not the lineup's `formation` label** — tallied in `teamRatingRaw`'s existing loop, keyed on a packed integer (`4-4-2` is 442) rather than a string, because that is the hot path an allocation once pushed past a timeout. It also defuses the latent mislabelled-lineup item for free.
- **4-4-2 and 3-5-2 are exactly zero**, which is the whole safety property. `pnpm season` byte-identical is the proof, and it was re-run after calibration, not only after the mechanism.

**The end-stop check that formation tempo made necessary.** Formation and the slider now **share the tempo channel and add**, which is exactly how a dominant strategy gets built from two individually-sane levers — and it is why the pre-existing "skip the full cross, they're orthogonal" argument no longer holds. Swept shape × slider: the full low-block corner (5-4-1 at slider 0) is best for **nobody**, Málaga included.

**`simulate.formations.harness.test.ts` closes the roadmap's own open item** ("the harness cannot see tactical exploits"). Two claims, because a shape can be wrong two ways: **strength** — strongest prefers 4-4-2 over 4-5-1 by ~9 points, weakest prefers 4-5-1 by ~3.4, and the criterion is that those differ; and **squad shape** — one club trimmed two opposite ways and compared against itself, `4-2-4 − 4-5-1` measuring **+7.3 thin-midfield against −5.7 thin-attack**. Verified it bites: setting 4-5-1's tempo to 0 fails the weak-club arm and the criterion. A separate file, at module scope, in a parallel worker.

**The domain project had no `testTimeout` and now does (30s).** `determinism at scale` runs 50 seasons twice and measured **5.5s against the 5s default** under load — recorded here once before as an unreproduced flake. A second harness file makes that contention likelier, so the budget is stated rather than left to luck. Same reasoning the app project's 15s already carries.

**`docs/attribute-model.md` was wrong and had been for two milestones.** It listed formation under "what turns out not to matter" at "under 1.5 points", and added that this would change once squads became unbalanced. M4 shipped, real rosters shipped, nobody re-measured: **the spread across the original four is 5.4 points at Villarreal and ≥2.0 at eight of twenty clubs.** The old figure was measured on generated squads, which scale every position from one club rating and so cannot be lopsided — **and the harness still runs on those**, which is why it never saw this. Rewritten with the measurements and dated.

**One-line truth fix taken while adjacent:** `lineup.ratingHint` said "these two numbers are all the match resolver sees", false since M3c added tempo and more false now.

**Eight buttons needed a grid, not a wrapping row** — `flex-wrap` put three, three and two across the 20rem rail. `LineupScreen.test.tsx` is new; there was no test file for that screen at all.

**Not seen in a browser** — seventeenth attempt not made: **another session was editing `sprites.ts`, `HubFigure.tsx` and `hub-figures.css` throughout this one**, and a full-suite run showed its in-flight sprite tests failing while every file of mine passed. Worth knowing for anyone reading the git history: two unrelated changes are interleaved in this working tree. **The appearance is unverified** — nothing here proves the 4×2 formation block reads well at 20rem or that a disabled shape is distinguishable from an unselected one.

**Known open items** — unchanged, minus the mislabelled-lineup one (now inert), plus: **`needFor` still evaluates every candidate in 4-4-2**, so the market cannot see a formation effect that now moves results, and eight shapes make that approximation looser than four did.

### 2026-08-15 (g) — the four figures move their props

**Prompted by a question that came with its own answer: "can you add a brief animation for the svg when you hover the section? like the trainer touching the ball."** The hub is the screen every tick of the day clock routes through, so it is the one place a small piece of life pays for itself repeatedly. 748 tests, typecheck / lint / format clean, `SCHEMA_VERSION` still 8, no domain change.

**The constraint that decided the whole design: `decodeSprite` grouped rects by ink and nothing else, so no prop was an addressable element.** For the trainer that is harmless — the ball is his only `accent`. For the other two suits it is not: **the agent and the director both draw a necktie in `accent`**, so animating that group would have slid their ties sideways. Ink cannot separate a tie from a seal, so a second axis had to exist before any CSS could be written.

**Case is that axis. Uppercase means "same ink, part of the prop"** — `a` is an accent pixel of the body, `A` the same accent inside the thing he carries. Chosen over a bounding box because a prop spans several inks (the clipboard is `light` paper, `ink` rules, an `accent` clip) and a box would have had to carve the tie back out; chosen over a parallel mask grid because one character per pixel stays diffable, which is the property `sprites.ts` was built around in the first place.

**`decodeSprite` now emits `part → ink → runs`, nested rather than flat, and the nesting is load-bearing.** A prop drawn in three inks would be three sibling groups each carrying its own copy of the animation — in step in practice, but only by the accident of all three starting together. One `<g data-part>` per part makes it structural. The nine fill rules are descendant selectors, so `data-ink` keeps painting through the extra level with no CSS change at all.

**Run-merging needed no change and that is the quiet load-bearing bit** — it merges across _identical_ characters, and `a` is not `A`, so a prop can never rejoin the body beside it. **A synthetic test is the only thing that can prove it:** case-folding the merge and running the full suite fails _nothing_ except `decodeSprite(['aaAA'])`, because no real grid places a prop pixel horizontally adjacent to a body pixel of the same ink. Checked by hand.

**Translate only, whole units, no rotation.** A CSS `px` on an SVG element is one unit of the local coordinate system and the figure renders at 8rem over a 32-unit box, so integers land on exact device pixels. Rotation would not — these are vector rects, so any angle produces smooth diagonal edges and the pixel art stops looking like pixel art. **The director lifts 1px, not 2:** his case top is row 21 and the jacket hem row 19, so a deeper lift swallows it. Nothing leaves the 28 × 32 viewBox, so `.screen`'s `overflow: auto` is never provoked.

**Playing once rather than looping is why there is no reduced-motion rule, and that is a consequence rather than a convenience.** `chrome.css`'s blanket floor forces `animation-duration: 0.01ms !important`, which with a finite iteration count lands the gesture on its identity end-state immediately — correct. **An infinite loop would instead spin at 0.01ms forever** and would need an explicit `animation: none` here. Worth knowing before anyone changes the cadence. `:focus-within` rides along on every selector, which is what a keyboard user gets in place of the hover.

**The strongest new guard is a column rule, and it is not the obvious one.** Every prop is held out to the right — the leftmost is the agent's contract at column 18 — while both neckties sit at columns 12–14. So _"no prop pixel below column 18"_ fails on a single stray uppercase character anywhere on a body. The explicit "keeps his tie out of the prop" test is kept beside it but is **weaker, and its comment now says so**: checked by hand, it only fires when the _whole_ tie moves, because one lowercase pixel left behind still puts `accent` in both parts.

**Every new test was checked against broken code, four of them in one run.** Uppercasing a single tie pixel, typoing an animation name, putting `fill` in a keyframe and dropping a `:focus-within` produced exactly the five expected failures and no others. The DOM guard was checked separately by deleting `data-part` from `HubFigure` — **the stylesheet tests and the decoder tests both stay green through that**, since neither can see the markup between them, and nothing on the hub would ever move.

**A trap this project has now hit twice: the comment explaining a rule is scanned as the rule.** The note above the keyframes explains what a _looping_ animation would have needed — `animation: none` — and the "names no animation it does not define" test read that sentence as a declaration and failed. Comments are stripped first now. Identical to how the hub's `nth-of-type` guard first failed.

**Verified by rasterising, not in a browser** — seventeenth failed extension connection, `list_connected_browsers` returned `[]`. A throwaway script in the scratchpad reads the real grids and the real stylesheet and emits every figure at rest _and_ at each keyframe extreme, side by side, on the actual `--fm-screen` ground. That is what confirmed the clipboard lifts, the ball hops up-left and rolls back, the contract shuffles, the case hefts — **and that both red ties are pixel-identical across all three of their frames**. Reach for it again: it proves the geometry of the end states without the app. **What it cannot prove is the timing**: nothing here shows whether 0.45–0.6s reads as a gesture rather than a twitch, or whether a 1px move is perceptible at all at the rendered scale.

**Note for the git history: another session was editing `LineupScreen`, `domain` and `data` throughout this one**, and its entry above says the same thing in the other direction. Determinism holds here by construction rather than by diff — **every file this change touched is under `packages/app`**, and `pnpm season` reads only `domain` and `data`. Running it would have measured the other session's work, not this one's.

**And then they smile, in the same sitting.** 759 tests. **A smile is not a transform** — it is a different set of pixels — so it could not ride the mechanism above and needed a second addressable part.

**Case had run out.** `body`/`prop` used lowercase and uppercase, and four parts were needed, so the two expressions carry their own characters through a second lookup: **`m` is the mouth at rest, `u` the smile** (the glyph is its own mnemonic), both drawing in `ink`. Which one is _visible_ is a CSS state, not a colour. `PART_KEYS` is now `body · mouth · smile · prop`.

**The two mouths interlock rather than overlap, and that is what kept every guard intact.** A smile's corners sit on the resting mouth's own row, either side of it, and its curve on the row below — so no pixel is claimed twice, the round trip stays exact, and paint order stays free. **It is also the constraint that fixes the shape**: with a 2px mouth at columns 13–14, row 7 offers only columns 12 and 15, which is why every smile is the width it is. Corners above the curve is the difference between a smile and a frown, and no other guard could tell those apart — both are four ink pixels on a face — so there is a test asserting the smile spans exactly the mouth's row and the one below.

**The director keeps his moustache and it does the smiling**, its ends lifting with the curve dropping below. Hiding it would have cost the one thing that reads him as the older man, and it leaves him the only figure whose smiling face is not the shared shape.

**Held while hovering rather than timed, which is why none of this needs a keyframe** — three plain rules, no `transition`. A cel swap, not a tween: cross-fading two mouths four device pixels apart is mush, and a transition would drag an expression under the reduced-motion floor for nothing. `opacity` rather than a `fill` swap, because hiding is the truer statement — painting the resting mouth in skin breaks the day a mouth lands on a shaded pixel.

**A collision in the test helper that would have rotted the round trip silently.** `expand()` rebuilt a character by reversing `INK_BY_CHAR`; with `i`, `m` and `u` all drawing in `ink` that map now collides and answers `u` for all three. It resolves the part first. **Reversing a many-to-one table is a trap worth remembering** — it was correct the moment before this change and wrong the moment after, with no error anywhere.

**One test guard genuinely moved, and it is not a band being widened.** `rects < pixels / 3` failed at 438/1,297 — it was 422 before, because `ssummus` breaks a face row into five runs where `sssiiss` took three, twice per figure. The interleaving _is_ the design, so the divisor is now 2.5 with the measured ratio (2.96×) written beside it. The claim being made was only ever "not one rect per pixel", which 438 against 1,297 still satisfies comfortably.

**A real bug, shipped and then caught by reading the file rather than by the suite.** The revert half of a deliberate breakage used a substring replace, and the `:hover` smile rule's tail matches the default rule's text — so it flipped the hover rule to `opacity: 0` too and **nobody would ever have smiled**. Every test still passed, because they asserted the _selector_ existed and not its value. Both now assert the value. **Generalising: a CSS guard that checks a selector is present has not checked the rule does anything** — and a scripted revert is exactly as capable of introducing a defect as the edit it undoes.

**Rendered rather than browsed** — the extension is still `[]`. The scratchpad rasteriser gained a smiling arm and a heads-only crop, and a small script printed each face as ASCII at rest and smiling, which is what actually settled the geometry; squinting at a PNG did not. Worth reaching for the ASCII dump first next time. **Honest limit, and it is sharper than the usual one: at the true rendered size the figure is 128px for 32 rows, so a mouth is four device pixels and the whole change is a handful of them.** The render at 4× scale reads clearly; at 1× it is subtle. Whether it registers in play is the one thing only looking at the real screen will answer.

### 2026-08-15 (h) — tempo stops being invisible

**Prompted by "what is the tempo thing, I don't see any tempo option in tactics."** There isn't one, and that was the defect. `TeamRating` has carried **three** numbers since M3c — `attack`, `defence`, `tempo` — and the app has only ever shown two. Presentation only: no domain change, no schema change, `pnpm season` byte-identical, and every file touched is under `packages/app`.

**The mechanic nobody could see.** `tempo` is set by two controls at once and announced by neither: the slider, as `(attacking − 50) / 50`, and — since the previous entry — the formation, via `FORMATION_TEMPO`. The resolver averages both sides and applies it to both scorelines, so a low block means fewer goals for everybody, more draws, and a draw is worth far more to the side that would otherwise lose. That is the whole reason containment is the underdog's weapon, and the "This XI" panel said nothing about it.

**A word, not a number.** `describeTempo` mirrors `describeApproach` exactly — a module-level function returning a **dictionary key** — reading Open / Balanced / Tight. Three bands where the approach slider has five, because openness is coarser than mentality and five words would imply a precision the model does not have. **The ±0.35 cuts are set against the values that actually occur**, not rounded for looks: at the default slider 4-2-4 reads Open, 4-5-1 and 5-4-1 read Tight, and 4-3-3 / 5-3-2 stay Balanced rather than overclaiming. Retune `FORMATION_TEMPO` and re-check that table.

**`lineup.ratingHint` is finally true, and is back to its original wording.** It said "These two numbers are all the match resolver sees" from M3b, which M3c falsified the moment tempo existed; the previous entry reworded it to a longer hedge. With the third stat on screen it returns to the clean sentence — and this time it is exactly right, because `expectedGoals` reads `attack`, `defence` and `tempo` off a `TeamRating` and nothing else (`atHome` is not a team property). **Three milestones of drift closed by adding the thing the sentence was working around.**

**The layout broke exactly where `CajaScreen` broke, and its rule is the fix.** Three stats in a 20rem rail where the third is a word, against a `.stat__value` that is `--fm-text-xl` with `tabular-nums` — sized for two digits. Caja hit this going two figures to three in an 18rem rail (`Saldo 5,7 M€` split across two lines) and its comment already states the rule: **wrap the row, never the value.** So `.lineup-screen__ratings` gains `flex-wrap` and a smaller gap, and a local `.lineup-screen__word` drops the word to `--fm-text-md` with `nowrap`. Kept block-scoped: Caja's is a _long number_ and this is a _word_, so it is a first use of that need, not a second. A third would earn `.stat__value--word` in `chrome.css`.

**Measured rather than eyeballed, since the extension was down:** 320px rail − 32px padding − 32px gaps = 256px for three stats; worst case is **Spanish `Equilibrado`** at ~88px plus ~104px of numeric stats = ~224px, so ~30px of slack with `flex-wrap` as the net. **Spanish is the long one, not English** — `Equilibrado` (11) against `Balanced` (8), which is the opposite of what I assumed going in.

**Testing note — the collision worth knowing.** `approach.balanced` also renders the word "Balanced", inside `lineup.approach` a few centimetres up the same rail, so `getByText(/Balanced/)` matches two nodes and proves nothing. Every assertion is scoped with `within()` on `.lineup-screen__ratings`. All four tests were checked against two _different_ mutations, because one mutation could not falsify them all: flattening `describeTempo` fails three of them and leaves "reads balanced on a fresh career" green, since a constant-balanced function trivially satisfies it — that one only bites when `FORMATION_TEMPO['4-4-2']` is made non-zero, which is the property it actually guards.

**Not seen in a browser** — eighteenth failed connection; `list_connected_browsers` returned `[]`. **The appearance is unverified:** nothing here proves the word sits well against two large tabular numbers, or that `--fm-text-md` beside `--fm-text-xl` reads as deliberate rather than as a mistake.

**Interleaving note:** another session's sprite work was in flight during the previous entry and is passing now; both changes are in this working tree together.

### 2026-08-15 (i) — every name is a way onto the card

**Prompted by "everywhere where the player appears you can click it and you are gonna see the profile."** The ficha is the richest screen in the game and **exactly two places could open it** — a Plantilla row and a Mercat listing. Everywhere else a name was inert text, so being offered €525k for a man meant leaving the screen and finding him again to see what you were selling. Eight call sites now. 778 tests, no domain change, `SCHEMA_VERSION` still 8, every changed file under `packages/app`.

**`.player-link` graduated to `chrome.css`, and the graduation is where the one real bug was.** `.squad-screen__name` and `.market-screen__name` were the same nine declarations twice over — the house rule's second use had already happened and gone unnoticed. Both are deleted and a test asserts they stay gone.

**`font` is a shorthand that covers neither `letter-spacing` nor `text-transform`, and that cost the negotiation panel its heading.** Both screen-local copies lived in a table cell, which sets neither, so both got away without them. The primitive's first landing inside `.screen__heading`'s `text-transform: uppercase` rendered **"Juanme" in mixed case beside headings that were all uppercase**. jsdom performs no layout and the app project runs `css: false`, so the whole suite was green through it — **only opening the app found it**, and `.data-table__sort` has carried the same two lines, for the same reason, since it graduated. `chrome.test.ts` now asserts all four inherits.

**Where a class goes on the link and where it goes on a wrapper is a `font: inherit` question, not taste.** `.lineup-row__name` is passed as `className` — pure layout (`overflow`/`text-overflow` for a `minmax(0, 1fr)` grid column, and the button needs `overflow: hidden` itself or the grid item's automatic minimum size blows the track out). `.offer-list__name` **wraps** instead, because it sets `font-weight: 700`: on the button that is a same-specificity fight against `font: inherit` settled by stylesheet import order, and inheriting the bold from a parent is decided by nothing at all.

**Two things deliberately not linked, and each has a test.** The radar key's **subject** name stays plain — `inspect` clears `comparedPlayerId` on _every_ open, so a link there would silently destroy the comparison the key exists to explain and navigate nowhere doing it; the symmetric-looking version is the mistake, so a test asserts the key holds exactly one button. And a bid whose player has left the game keeps `market.unknownPlayer` as text: there is no card behind it.

**The compared player's name is the first ficha→ficha link, which finally exercises a guard written in M4b and dead ever since.** `inspectedFrom: from === 'player' ? get().inspectedFrom : from` (`store.ts`) means back from the second card returns to **the list you started at**, not to the first card. Confirmed in the browser: Plantilla → Omar El Hillale → compare → Quilindschy Hartmel → **Tornar lands on Plantilla**. Mutating that line to `inspectedFrom: from` leaves back on a card with no player, rendering the empty state — and **nothing in the suite caught that mutation before this entry.**

**The rival ficha stopped lying.** `player.inXI`/`player.onBench` reads _your_ team sheet whoever the card is for, so a man at another club was told _"On the bench. Change the lineup to start them"_ — false, and an instruction you cannot follow. The line is now gated on his actually being in your squad, and the header carries the **owning club's badge** (`market.freeAgent` reused for nobody's man rather than a fourth entry in three dictionaries). The pair of tests is the constraint: hiding the line for everybody satisfies the rival arm on its own.

**The lookup was rewritten to hand back the club with the player** rather than `flatMap`-ing every squad into one array and finding him in it — same three-tier fallback, one fewer allocation of ~500 players per render.

**No new dictionary keys in any of the three languages**, which is unusual enough to state: everything these links render is a player's name, which is data. `PlayerLink` deliberately carries **no `aria-label` and no `title`** — its accessible name _is_ the name, and ~30 assertions across five files resolve these men by exactly that. A label would have needed three dictionary entries and broken every one of them.

**Every new test was checked against the unfixed code, in four batches, and the batches were chosen so no two tests could be satisfied by the same mutation.** Reverting the five markup conversions fails eight; the two store mutations and the symmetric-link mistake fail four more, one each; hiding the club and un-gating the status fail two; hiding the status for everybody fails the arm the previous batch could not reach. One stale selector was found this way too — `rowNames()` in `MarketScreen.test.tsx` queried `.market-screen__name` and would have silently returned empty strings.

**The `<option>` limitation, stated rather than solved:** lineup bench players and the ficha's compare picker are `<option>` elements, which cannot hold a control. Everyone on both lists is a Plantilla row, so the gap costs a detour rather than a dead end. **The news feed is also deliberately out of scope** — names are interpolated inside whole translated sentences (`news.bidMade` and five others), and linking them means either splitting sentences across the i18n layer or making the whole notice one click target, which is a different gesture. Both are decisions, not oversights.

**Seen in a browser — the extension connected, second time ever.** Verified across a full loop at Sarrià: the XI links and the row layout holding, back from a ficha returning to the _lineup_, a bid made and reopened from `Les teves ofertes`, the rival's card showing Getafe's badge with no XI line, `En venda` inheriting its bold, and the ficha→ficha route above. That is what caught the mixed-case heading, which no test could have.

### 2026-08-15 (i) — the radar stops clipping, and the ficha splits in half

**Reported by playing: "`POR` and `PAS` are not visible — the component is sized as square and it is clearly not."** Both halves of that were right, and the second half is the diagnosis. 778 tests, no domain change, `SCHEMA_VERSION` still 8, `pnpm season` unaffected — every file is under `packages/app`.

**The cause is an interaction between two things that are each correct.** `labelAt` anchors the left-hand labels `end` and the right-hand ones `start`, deliberately, so text grows _away_ from the rings — its comment has said so since the radar shipped. The two **horizontal** axes put their anchors at `x = 8` and `x = 112` in a `0 0 120 120` box, so those two labels grow straight out of the viewport, and an `<svg>` clips to its viewport. The diagonals anchor at `x ≈ 23 / 97` and stay in; the top and bottom are `middle`-anchored. **So exactly two labels of eight vanish, and they are the two the report named** — index 2 is `passing` and index 6 is `keeping`.

**The fix is the window, not the geometry, and that is forced rather than chosen.** `radar.test.ts` hardcodes its own `CENTRE = 60`, asserts every spoke lands at `hypot ≈ 40`, and asserts each label sits beyond radius 40. Pulling `LABEL_RADIUS` in or shrinking `RADIUS` to buy room fails those. `RADAR_VIEWBOX` is asserted by nothing, so widening it costs no test and moves no drawing: `LABEL_ROOM = 16` a side, `-16 0 152 120`, derived from `CENTRE` rather than typed so the three numbers cannot drift apart.

**`max-width` had to move with it, and missing that would have been a silent regression.** `.radar` is `width: 100%` capped at 17rem against a viewBox 27% wider — same CSS width, every drawn unit 27% smaller, so the rings and the 7px labels would all have shrunk to pay for the gutters. It is 22rem now (17 × 152/120): **the ring keeps the size it had and the extra width is nothing but label gutter.**

`overflow: visible` was the other candidate and is worse — it paints the labels outside the element's own box, over whatever sits beside them, and is still clipped by any ancestor that scrolls.

**Measured before rendering, because a font stack is not a guess.** A throwaway script lays each label out with Helvetica-Bold AFM advances — the _widest_ face the `--fm-font-condensed` stack could fall back to, since 'Helvetica Neue Condensed' and 'Arial Narrow' come first and are ~25% narrower — and checks the ink against the real viewBox in all three languages. Worst horizontal slack **8.0 units**; nothing clipped. **Run against the old box the same script reports exactly six clipped labels — `PAS` and `POR`/`KEE`, one pair per language, and nothing else**, which is the report reproduced from arithmetic alone. Reach for that shape again: it localises a clipping bug without a browser and it proves the fix is sized, not eyeballed.

**Second ask, and it is a one-liner: `.ficha__body` splits 50-50.** It was `minmax(0, 20rem) minmax(0, 1fr)` — the chart pinned at 20rem and the attribute list absorbing _every_ remaining pixel, which at 1440 is ~1030px for eight bars. `repeat(2, minmax(0, 1fr))`. `.attr` has a hard floor of ~13rem (`5.5rem 1fr 2ch`, and `5.5rem 1fr 2ch 2ch 3.5ch` while comparing), so half is never the binding constraint and `chrome.css` needed nothing.

**Seen in a browser — sort of, and the fallback is the part worth keeping.** `list_connected_browsers` returned a browser and then `[]` on the very next call, the same flap recorded at the hub-figures entry. So the app was driven in **headless Chrome over CDP** instead — Node's native `WebSocket` against `/json/list`, clicking Setup → Plantilla → a player exactly as a person would. That is real rendering with the real font stack, and it is a better fallback than a DOM dump for anything visual. Confirmed at Courtois' ficha: `grid-template-columns: 683px 683px`, `viewBox="-16 0 152 120"`, radar `352 × 278` (22rem, and 352 × 120/152 = 278 — the aspect ratio comes off the viewBox with no `height` anywhere), all eight labels whole. At 700px the body is a single 650px column and the radar still fits, so the pre-existing 48rem collapse is untouched.

**Known, and left alone deliberately:** with the chart column now ~43rem and the radar capped at 22rem, the left half has visible air where it used to be nearly full. Raising the cap is one token if it grates, but 22rem is the figure that keeps the rings exactly the size they were, and no single cap is right at both 1440 and 1920.

**Noticed while reading, not fixed:** `PlayerScreen.tsx` has `BAR_FLOOR = 45` and bands at `85`/`64`, while its own header comment and the 2026-08-15 (e) entry both say the bars were rebased to a floor of **40** and the bands re-cut to **88 / 62**. Documentation drift on three numbers, no layout consequence.

**Note for the git history: the `PlayerLink` session was editing this tree throughout.** A full run failed once in `chrome.test.ts` on a mid-write read of `MarketScreen.css`, and `pnpm typecheck` / `pnpm lint` report only that session's half-written `PlayerLink` imports (`LineupScreen.tsx:16`, `PlayerScreen.tsx:22`, `PlayerScreen.test.tsx:243`). Everything re-ran green in isolation; the three files here are `radar.ts`, `radar.css` and `PlayerScreen.css`.
