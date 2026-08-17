# Roadmap — PC Fútbol-style Manager

**Scope:** Football management game in the idiom of Dinamic's PC Fútbol. No real-time match engine — results resolved statistically. Fictional clubs/players by default, with dataset import as an opt-in layer.

**Estimates** are in _focused weeks_ (~35h). For evenings-and-weekends (~10h/week), multiply by ~3.5.

---

## Target and direction

**The first delivery targets PC Fútbol 5.0 (1996/97). The depth of the later games is the direction, not the v1 scope.** Decided in [ADR 0008](./adr/0008-target-pc-futbol-5.md); 2001 was five years of accumulated depth on a game that was already shipping, which is an ambition rather than a first release.

|                           | Milestones | What it is                                                                                                         |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| **The 5.0-shaped game**   | M0–M5      | One league. Squads, lineups, tactics, a transfer market, an economy and a board. Playable and coherent on its own. |
| **The drift toward 2001** | M6–M7      | A living squad — injuries, suspensions, form, training. Then a cup, a second division, Europe, youth and scouting. |

This does not soften ground rule 5. Growth stays additive because of seams already in place — `reduce` as the single door, versioned saves with migrations, enforced package boundaries, and a resolver contract that swapped suppliers at M3 without changing signature — **not** because things were abstracted ahead of a second case. The ladder below is the scalability plan.

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

**The look is a 1996 Spanish CD-ROM, not a terminal.** The default retro answer — dark background, acid-green monospace, scanlines — is 1980s BBS and wrong for the subject. Dinamic's visual language was _hardware_: bevelled panels you could press, with data sunk into inset screens. That vocabulary is Windows 95, which is where 5.0 lands — see [ADR 0008](./adr/0008-target-pc-futbol-5.md). So the chrome has two materials, and the distinction is structural rather than decorative:

- `.panel` — raised, bevelled, holds controls and labels
- `.screen` — recessed, dark, holds data

The one real information device is the **position band**: a colour spine on each table row. That is how every Spanish classification is read, so it encodes qualification rather than decorating a row — **1 champion, 2–4 Champions League, 5 Europa League, 6 Conference League, bottom 3 relegated**, with a legend under the table and text for readers who cannot use colour. The signature is the **ficha** — the player card with eight attribute bars.

Three decisions worth recording:

- **No router.** Navigation is a value in the store. This is a game, not a site: there are no URLs to share and no back button to honour, so a router would be a dependency bought for nothing.
- **Attribute bar widths use bucketed `data-fill` attribute selectors**, not a JSX `style` prop. The styling convention has no exception for data-driven values, and 5% steps are visually indistinguishable from exact.
- **Lineup validation lives in the reducer, not the screen.** `SetLineup` runs `startersOf`, so an illegal XI cannot reach a matchday through any route — a screen can forget, the reducer cannot.

---

## M3c — Choose your club, and make tactics a decision ✅

**done 2026-08-14**

Two open questions closed. Two others recorded rather than solved, because they are not code.

**You choose a club.** `newSeason` defaulted to `clubs.at(-1)`, so every career started at Almería — a default nobody chose, and the club with the least to play for. There is now a setup screen listing all twenty with their ratings and what the season realistically holds, from "Contender" to "Relegation favourite".

**Tactics became a decision.** The slider was measured and found to be a trap: upside 0–3 points, downside −4 to −9, balanced optimal everywhere. It only ever redistributed strength between attack and defence, so nothing described how _open_ a game was and a low block could not do the one thing a low block is for.

`TeamRating` gained a third number, `tempo`, applied to **both** sides' expected goals — see [attribute-model.md](./attribute-model.md#step-4--modifiers). Fewer goals means more draws, and a draw is worth far more to the weaker side. Measured over 40 seasons:

| Club                | Best approach  | Gain     |
| ------------------- | -------------- | -------- |
| Madrid 88/85        | all-out attack | **+3.5** |
| San Sebastián 70/74 | attacking      | +1.3     |
| Vigo 65/65          | balanced       | —        |
| Getafe 59/60        | balanced       | —        |
| Almería 49/50       | low block      | **+2.9** |

**The term vanishes at balanced tactics**, so every M2 and M3a harness band passed unchanged and `pnpm season` is byte-identical. That is what let a calibrated model be extended without re-tuning it.

`MODEL.TEMPO = 0.6` sits between two failures: below ~0.4 the effect is inside the noise and the slider stays decorative; above ~0.9 the strongest club gains 7+ points for simply always maxing out — a dominant strategy wearing different clothes.

**Still open, and not code:**

- **Nothing has been looked at in a browser.** The Chrome extension has refused to connect across three attempts, so the UI is verified by build, tests and rendered-DOM dumps only. _(Resolved in part on 2026-08-15, after thirteen consecutive failures: the extension connected twice, and both sittings immediately found defects reasoning had not — a three-stat rail wrapping `Saldo 5,7 M€` onto two lines, and the transfer-window badge verified across a full career including the summer opening the day clock cannot reach. Connection remains unreliable and most screens are still verified by DOM dump, so "the appearance is unverified" stays the honest default.)_
- **The manager still has little to manage, and that is expected.** Tactics are worth ~3 points; a single goalkeeper is worth +10.5. The squad is the real lever and M4 is what changes it.

---

## M4a — A market that runs itself ✅

**done 2026-08-14**

**M4 splits, and the roadmap's own exit criterion says so** — "sim ten seasons headless with no human input; squads should still look reasonable and no club should own 40 players" contains no human, no bidding and no screens. M4b adds the human's side.

**Three prerequisites the one-liner hid.** There was **no season rollover** — `simulateSeasons` regenerated all 460 players every August, so a squad could not drift and the exit criterion was unmeasurable. There were **no contracts**, and **no money**. All three landed here. (Ageing came free: `ageOn` derives from `birthDate`, so advancing the clock ages the league.)

**The AI is a scoring function, not a rule tree**, exactly as the roadmap insists. A club's need for a player is the **marginal gain in its team rating** from adding him. There is no rule limiting goalkeepers — once a club has a good one, a second cannot enter the XI, so his need score is zero. Squad size is likewise a consequence of needs falling away, not a cap.

**Exit — met.** Ten continuous seasons: champions rotated across four clubs (Barcelona ×4, Madrid ×3, Manzanares ×2, Sevilla), champion points 79–96, squads 18–25, mean age steady at 27, and the pecking order held without inverting or running away.

**Money is conserved exactly** — 27,854k in the league every season for ten seasons. That is the structural invariant most likely to catch a real bug, and it is never to be loosened.

**Superseded at M5a, and by something stricter rather than looser.** Once revenue started creating money and wages started destroying it, conservation could no longer hold — so it was replaced by the per-club **ledger identity** of [ADR 0009](./adr/0009-the-ledger-identity.md): every movement writes a line, and a balance changes by exactly what its ledger says, checked per club on every tick. The old invariant could only say the league had inflated; this one says which club and on which line. The measurement above stands as M4a-era history.

**The harness caught a real one.** With squads carrying forward and nobody retiring, the league aged into a retirement home — mean squad age 33.75 after ten seasons. Fixed with retirement from 33 (certain by 39) and a youth replacement at the same position. That is _not_ the youth academy, which is M7's scouting and development; it is the minimum inflow a career needs to survive.

**A known imbalance, and M5 is the fix.** Money only moves between clubs, never in. After a decade the three richest hold 21.5M of the league's 27.9M and the poorest are down to single-digit thousands, so a small club eventually cannot buy anyone. Revenue is what makes that a cycle instead of a ratchet.

---

## M4b — The human in the market ✅

**done 2026-08-14**

Bids and counter-bids, personal terms, a free-agent pool, a transfer screen and a shortlist. Six new commands — `MakeBid`, `WithdrawBid`, `OfferContract`, `RespondToOffer`, `Shortlist`, `StartNewSeason` — all validated in the reducer, because a screen can forget a rule and the reducer cannot.

**Exit — met, and measured.** Over 60 seasons, a mid-table club that shops each summer finishes **+3 points and half a place** above the same club, same seed, standing still. Isolated to a single signing: an +18-overall goalkeeper is worth **+3.3 points and 1.3 places**.

**No signing bonus.** Wages and length only, so wages stay recorded-but-unspent and **no money leaves the league** — `totalBudget` conservation is exactly the invariant M4a set, not a relaxed version of it. The bonus belongs with M5's wage bill.

**The whole bid subsystem draws no randomness, and that is a requirement rather than a style.** Bid resolution runs inside `AdvanceDay`, which is the path every calibrated band in the project is measured through; one `rng.next()` there shifts every downstream draw. Answers are a comparison against `askingPrice`, the delay is a fixed offset, and incoming offers are derived from `needFor`. The result is that `pnpm season` is **byte-identical to M4a** and every M2/M3a/M3c band passed untouched — the same discipline that let M3c's `tempo` extend a calibrated model by vanishing in the default case.

**Two things were badly out of scale, and only became visible with a human in the market:**

- **Budgets were a fraction of one player's price.** A club rated 62 held 946k while a player of its own first-team standard asked ~3,300k. Measured across the whole league: 48 of 228 listed players were affordable to a mid-table club and **every one of them scored zero on need**. The AI never noticed because its value-for-money filter only ever buys cheap marginal players. The base is now 2400 rather than 400, chosen so a budget buys roughly two players of the club's own standard; the exponent is untouched, so every club's share of the league's money is exactly what it was. This does not make the AI spend more — a career at 4×, 6× or 10× produces an identical league.
- **Deleting unsigned free agents each summer drained the pool to nothing.** Releases outnumber signings, so every squad ground down to the floor, at which point nothing more could be released: the pool measured 45, 37, 15, 3, 0 and stayed empty from season six, closing the only route into the market a poor club has. Left alone the pool balances itself, and age removes players as it removes everyone.

**Expiring contracts are no longer auto-renewed.** A club renews a player only if he still improves its XI — the same marginal-rating score the market runs on, asked in the other direction. Everyone else walks.

**The reducer stopped rebuilding the manager's XI behind his back.** `applyTransfers` and `rolloverSeason` re-picked `bestXI` for _every_ club, so any two clubs doing business wiped out a hand-picked team sheet. AI clubs still revert to their strongest XI — it is the only place they pick a team — while the manager's selection stands until it is actually illegal. The consequence is real: signing a player no longer selects him, which is why the harness's manager dispatches `SetLineup` after buying.

**Schema v5**, plus `scripts/fixture.ts` so a fixture save for the current version is a command rather than an archaeology exercise. Ordering matters and is easy to get wrong — it must run _before_ the next migration exists.

---

## M4c — The sell side ✅

**done 2026-08-14**

M4b shipped a market you could buy in. Selling existed on paper and was unreachable in practice, which is a good illustration of why a feature is not done until somebody plays it.

**A transfer list.** Your club is invisible to the AI market by default — that is what stops it trading your squad behind your back — so nothing you owned was ever in front of a buyer. `ListPlayer` opts one player, and only that player, back into the pool AI clubs already shop from. Spare players only, by the same `surplus` rule the AI sells by, re-checked at window time: a player listed in August who has won his place back by January is not sold out from under you. **The listing is the consent**, so a listed player who attracts a buyer goes; the inbox stays for unsolicited offers.

**The bug this milestone existed for.** Incoming offers were generated on "the first of a transfer-window month". The clock enters every season on **15 August** and `StartNewSeason` jumps straight to the next 15 August, so **1 July and 1 August are never reached** — leaving exactly one generation day a year, 1 January, producing at most one offer. A manager could play for seasons and never be approached. Offers now arrive **weekly while the window is open**, and a listed player attracts interest on far less need than an approach out of the blue.

**Three real defects surfaced underneath, each hidden by the one above it:**

- **`expectedWage` was derived from `valuePlayer`, which multiplies by `contractFactor` — zero for an expired contract.** So every free agent and _every renewal in `rolloverSeason`_ came out on the 50 floor. A fee collapses as a deal runs down; a wage does not — a player out of contract wants more, not a token. Wages now come from quality, age and scarcity alone.
- **A free agent looked costless, so nobody ever paid a fee again.** Ranking need per unit of _fee_ gives a zero-fee player an unbeatable ratio, and with one signing per club per window every club took a free agent every time — the pool is never empty, so a player with a price on his head was never bought at all. Value is now need per unit of **fee plus wages**, and a club may make one paid signing _and_ one free transfer, because those are different resources: a free transfer does not touch the transfer budget.
- **`surplus` was evaluated once at window open, then trusted.** Two of a club's forwards could each be spareable alone and leave it with two between them — a squad that cannot field a 4-3-3, which the career harness forbids. Sales are now re-checked against the squad as it stands.

**Squads were quietly draining to the legal minimum.** Releases used `MIN_SQUAD` as their floor, so every club settled at exactly 18 — and `surplus` returns nothing at 18, which freezes the market: nobody lists anybody, there is nothing to buy, and you cannot sell either. The league sat at a mean of 18.4. Releases now stop at a _healthy_ squad size rather than the legal one, and squads hold at 18–23 with a stable pool of ~45.

**Exit — met.** The M4b criterion is re-measured at **+4.3 points and 2.2 places** a season over 60 seasons. `pnpm season` is still byte-identical to `426f2f6`, and every M2/M3 band is untouched: the market tick remains rng-free.

**Schema v6**, with `fixtures/v5.json` captured by `pnpm fixture` before the migration existed — the one moment it could have been.

---

## M5a — Where the money comes from ✅

**Split, for the same reason M4 was: the exit criterion has no human in it** while the milestone's prose names three screens. So the harness settles the economy headlessly, and M5b builds the board against a model already known to balance.

Gate receipts, TV, sponsorship, prize money, the wage bill, and the signing bonus deferred from M4b. Debt down to a limit, with interest. Schema v7.

**Exit met, measured over 50 headless seasons:** **0 of 1000 club-seasons below the overdraft limit**, and the league total settles at 2.1× its opening figure rather than compounding. The imbalance this milestone existed to fix is fixed — **the top three clubs held 77% of the league's money after a decade of M4a; they now hold 24%**, and the gap between richest and poorest narrows from 8× to 3× over fifty seasons instead of widening.

**"Money is conserved" is gone, replaced by a stricter ledger identity** — see [ADR 0009](./adr/0009-the-ledger-identity.md). Every movement writes a line; a balance changes by exactly what its ledger says, checked per club on every tick.

**The tuning was the milestone, as predicted.** Three findings worth keeping: income must be as convex as wages or the table inverts; a fixed surplus compounds without limit, so the brake has to grow with the pile (wage inflation); and that brake must tax the excess over a healthy reserve rather than the balance, or the opening budget is vaporised in season one.

---

## M5b — The board ✅

Ticket pricing, stadium expansion, board objectives and the sack. The three `Finanzas` tiles are live. Schema v8.

**Exit met.** The board sets a target scaled to the club's standing, warns you when you miss it and dismisses you the second time running — which ends the career at the club picker. Caja states every ledger line against last season's, so the money that M5a made move is now money you can account for.

**The board judges league position and nothing else**, which was a deliberate choice with a cost worth recording: **the overdraft M5a built still has no teeth.** A club may run to its limit and nobody will mention it. Debt becomes a consequence when there is something to attach it to.

**Two findings, both from rendering it rather than reasoning about it:**

- **A ticket priced at 0.0069 thousands rendered as "€0k".** `formatMoney` is right for every other figure in the game and useless for the one price a supporter would recognise.
- **Charging the maximum was strictly best** — €184k a match rising to €299k for slamming the slider — because the price was folded in _before_ `MIN_OCCUPANCY`, so the floor absorbed the damage. **This is the M3a tactics-slider exploit arriving by a different route.** Price is now a multiplier applied after the clamp, and `PRICE_SENSITIVITY` is set so the best price falls at 1.5× the default rather than at an end stop. There is a test that walks the range and asserts the peak is interior.

**What makes Estadio a decision is the pair, not either lever.** At the revenue-optimal price the ground is 42% full, so expanding is worthless; drop the price to 0.7× and it is 65% full and seats start to pay. Price alone is still an optimisation — what would make it a dilemma is supporters who resent being gouged, and that needs morale at M6.

---

## Between M5 and M6 — the polish phase

**Not a milestone. Recorded because it happened and this file did not say so.**

Two days and nine commits sat between M5b and the start of M6, and no milestone moved. That stretch is now visible in the numbers: **+6,746 / −936 lines across 74 files** — roughly 30% of the codebase — with **81% of the insertions in `packages/app`**. The whole of it went into presentation, and none of it into M6 or M7.

**What shipped:** club badges (kit colours, shirt patterns and shapes, no crests — see [ADR 0007](./adr/0007-intellectual-property.md)); the hub rebuilt as four coloured quadrants with twelve icons and four pixel-art figures, replacing the nav rail entirely; a news feed, and then its removal from the shell once the hub became the only place the day advances; the ficha grown an attribute radar, a squad-mate comparison and a block explaining which attributes actually count for what; real stadium capacities in place of a curve on rating; squad numbers, wages and contracts on Plantilla; the transfer window given a badge and then a countdown; a form strip and the league position moved onto the hub; and **three languages**.

**Why it was not waste, and this is the transferable part.** The suite was green throughout, and this phase still turned up defects that only surface when somebody plays:

- **A transfer you could not close.** `NegotiationPanel` had no `key`, so switching between two live bids reused the component instance and left the previous player's wage in the field — an offer below what the man wanted, silently refused, with the panel itself mounted above the scroll viewport where the button appeared dead.
- **The market's 60-row cap was hiding exactly the wrong players.** A bare `.slice(0, 60)` on a list sorted by improvement showed a weak club sixty players it could not afford while ~90 useful, affordable signings sat below the cut — the precise opposite of what M4b's exit criterion needs.
- **A ticket rendered as "€0k"**, and **the overdraft _limit_ was printed as a negative figure** beside a balance in credit, so headroom read as debt to the only person it was for.

Each was found by looking, not by testing. The lesson the milestones keep re-learning is that a feature with green tests is not a feature somebody can use.

**What it cost, honestly:** the ~40-screen UI estimate in the cross-cutting tracks below is the line item this phase drew down, and it added a permanent per-screen tax in the form of three dictionaries. Both are recorded there rather than here.

**It did not stop there**, and the honest label is that the polish phase is still running. Since the section above was written the phase has also taken every table sortable, added four formations and given the shape a tempo, made the tempo visible, and **merged Alineació and Tàctiques into one tile with a pitch on the screen** — the reference's own arrangement, a squad table beside a shape. That last one closed a two-tile-one-screen arrangement the hub had carried since the quadrants landed, and freed the slot for **Entrenaments, badged M6** — the first time the hub has named a milestone it has not reached.

**What that says about the hub as a roadmap:** it works, and it is a commitment. A disabled tile is a promise with a date on it, so a milestone that slips is now visible to the player rather than only to this file.

**The phase also finally answered its own recurring complaint.** Twenty entries in this log end with some version of "not seen in a browser". The Chrome extension has connected once in twenty attempts, and the way through turned out not to need it: `pnpm build && vite preview`, headless Chrome with `--remote-debugging-port`, and a throwaway driving CDP over Node 24's native `WebSocket`. The first screen driven that way — the relaid lineup screen — had **three** layout defects that a green suite, a DOM dump and an SVG raster had all missed, including the entire forward line sitting below the fold. **Treat "verified by tests and a DOM dump" as unverified for anything about size, order or overflow**; the tooling to do better is now a known quantity and costs a few minutes.

**And then it closed the last duplicate tile, which cost a schema bump.** Clasificació and Resultats had both carried `to: 'table'` since the quadrants landed — the same two-tiles-one-screen arrangement Alineació/Tàctiques had, and the last of them. Resultats is now its own screen: a **20 × 20 cross-table** of every result in a season, and a **Palmarés** tab with the league's roll of champions and your own club's honours, headed by a pixel-art trophy keyed by competition so the cup and the supercup are each a grid plus a palette.

That one could not be done in the app alone. **`rolloverSeason` replaced `season.fixtures` wholesale, so pressing _start season_ destroyed every result and every final position in the league** — a palmarés was not merely unbuilt, it was underivable. `GameState.history` (schema **v9**) archives each finished season's fixtures whole, and the final table is _derived_ from them by `computeTable` rather than stored, since a second copy can only disagree with the first. Written in `rolloverSeason` rather than the command handler, for the reason prize money is: `simulateCareer` calls the rollover directly, so an archive written only in the reducer would be missing from every headless career.

**What it costs, stated rather than discovered:** ~42 KB per finished season against a 159 KB save, so roughly 9× the current save per decade and a megabyte-scale export after thirty years. That was chosen deliberately over storing champions alone, and it is what buys the season picker — you can open any past season's results, not just read who won it. It draws no randomness, so `pnpm season` stayed byte-identical and every M2/M3/M5 band passed untouched.

**A palmarés is not the "historical encyclopedia" non-goal below.** That non-goal is Dinamic's editorial product — curated real-world football history. This is the save's own record of seasons it has played, and it is what makes a decade of career feel like one.

The blow-by-blow lives in `CLAUDE.md`'s session log; this section exists so the roadmap is not silent about the work.

---

## M5c — Sponsorship

**~1 week**

`BASE_SPONSOR` is one constant standing in for a club's whole commercial life. M5c makes it a set of **named deals** — shirt, kit, training, cars, clothing — each with a value and a term, and each able to arrive and to end.

**Deals come and go in proportion to performance, and purely deterministically.** A run of form or a league position earns a deal and holds it; falling away loses it. No `rng` anywhere in it, so no second stream, no change to the save envelope, and `pnpm season` stays byte-identical — the same discipline `bids.ts` lives under. It is unpredictable to a manager without being random to the engine.

**The warning is the feature, not a nicety.** A deal that is about to end has to be announced far enough ahead that the manager can sell or release before the loss lands. A sponsor that simply vanishes on a settlement day is a bug report, not a decision.

**Why sponsorship and not the gate or TV.** The three revenue lines now do three different jobs — see [market-model.md](./market-model.md). The gate rewards an inherited ground, TV is the flat floor that keeps a small-stadium club solvent, and **sponsorship is the only line still shaped by how good you are**. That makes it the one that can be volatile without bankrupting anybody: what you lose when a sponsor leaves is what you earned by being good, and the floor underneath is untouched. It is also why `BASE_SPONSOR` was deliberately left alone when the TV pool was raised.

**One design question to settle at the start, not now:** deterministic is not stateless. A three-year deal signed in 2028 is state on `Club`, which means a schema bump and a migration — or the term is derived from form history the game already keeps, and it is not. Decide that before writing anything.

**Exit:** a club can name its sponsors and what each is worth, a good season attracts one, a bad run loses one, and no deal ever ends without a warning first.

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

**Data pipeline** _(**unstarted — deferred to M7, unscheduled.** Originally "starts at M3, ~2 weeks total")_
Derivation layer mapping FBref/StatsBomb per-90 stats onto the eight attributes — skeleton mapping table already in [attribute-model.md](./attribute-model.md#bridge-to-the-data-pipeline). Pure functions, unit-tested. openfootball for club and league structure.

**None of this was built.** M3 came and went and `packages/data/` is three files — `clubs.ts` (twenty hardcoded clubs with ratings and real capacities), `names.ts` (the Spanish name pools) and a barrel. The 5.0-shaped game reached M5 without a byte of external data, because generated squads round-trip club strength and city-named clubs need no licence; the track was scheduled against M3 for no stronger reason than that M3 was where players arrived.

**It is re-pointed at M7**, which is the first milestone with an actual consumer: scouting and fog-of-war want a real attribute distribution to be uncertain _about_, and a second division wants a league structure to import. Dataset import stays the opt-in layer [ADR 0007](./adr/0007-intellectual-property.md) describes — what the layer may _ship_ as opposed to _read_ is still deliberately open there. The `pace` mapping risk travels with it; see Risks.

**Ships with unlicensed city names by default** — a club is its city (Madrid, Barcelona, Sevilla), and a city's second club takes the district or ground it is identified with (Manzanares, Heliópolis, Sarrià, Vallecas). A city name is not a club trademark. Real club names stay a user-supplied import. **Player names no longer are**: as of 2026-08-15 the opening squads are shaped on real rosters with every surname altered, which answers the question ADR 0007 left open — the data layer ships data, not only a format. Reasoning and the accepted risk in [ADR 0010](./adr/0010-real-squad-shapes.md); the club-naming half of [ADR 0007](./adr/0007-intellectual-property.md) is unchanged. Youth intake and free agents still come from the Spanish name pools.

**Save migrations** _(continuous)_
Every schema change gets a migration and a round-trip test against a stored fixture save from the previous version. Keep one fixture save per shipped version in the repo. See [ADR 0005](./adr/0005-persistence.md).

**UI** _(continuous from M3)_
Table-heavy screens reading from a store. Expect ~40 distinct views by M7. The retro chrome is fun to build, but each screen still needs wiring — budget for it.

The mitigation for the screen-count risk is a shared chrome layer (`packages/app/src/styles/chrome.css`) good enough that a new screen is markup and data wiring with no new CSS. That is why styling is plain global CSS with block-element names rather than per-component modules — see [stack.md](./stack.md#styling--plain-css-global-block-element-class-names).

**Measured at ten screens, that mitigation is partly holding.** `chrome.css` carries 569 shared lines against ~1,000 lines of per-screen CSS — so "no new CSS" is not true, but the trend is right and the split is the one you would want: routine table screens are nearly free (Squad 40 lines, Setup 40, Estadio 67, Caja 71) while the signature screens are not (Hub 383, Market 193, Player 146). Keep graduating a primitive to `chrome.css` on its _second_ use and the routine screens stay cheap; the expensive ones are expensive because they are bespoke, which is the correct reason.

**i18n** _(shipped, off-roadmap, continuous from here)_
Three languages — **Catalan (default), Spanish, English** — hand-rolled with no dependency, per [stack.md](./stack.md). ~334 keys × 3 dictionaries, plus `format.ts` for money, percentages, counts and dates, because `€12.4M` is `12,4 M€` in ca/es and the separator is not a suffix you can bolt on.

This was never on the roadmap and it is a **standing tax on everything after it**: a new screen now costs its markup, its data wiring, _and_ three dictionary entries per string. Budget it alongside the ~40-view estimate above rather than as a one-off.

The known gap: `dictionaries.test.ts` enforces key parity in both directions and identical `{parameters}` across languages, but it **cannot see a key nobody uses** — parity is not coverage. Two orphans have already been found by hand (`market.openNegotiation`, unused from the i18n pass until the negotiation bug; `shell.next`/`shell.today`/`shell.inDays`, orphaned when the bar stopped telling the time). A periodic grep for unreferenced keys is the only guard there is.

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

**The attribute model is load-bearing.** Getting it wrong surfaces as vague "the game feels arbitrary" complaints in M4, three months after the mistake. _Now specified_ in [attribute-model.md](./attribute-model.md), including the M3→M2 contract. The residual risk has moved: it is no longer "we haven't decided", it is "the `pace` derivation from FBref has no direct source stat" — flagged in that document. **It was to be resolved during M3's data work; that work did not happen and M3 is closed**, so the risk now travels with the deferred data-pipeline track above rather than expiring silently with the milestone it was pinned to.

**Screen count is the silent cost.** The domain work is genuinely tractable; forty table screens is what actually eats the calendar. **Ten screens in, and the polish phase above is what this risk looks like when it arrives** — it does not present as "too many screens", it presents as two days of work on the ten that exist.

---

## Known open items

Small, real, and deferred more than once. They live here rather than only in `CLAUDE.md`'s session log, because an append-only log is where a one-line fix goes to be deferred a third time.

| Item                                                          | Where                                                                                                                                      | Note                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Matchday number disagrees by one**                          | `TableScreen.tsx` computes `Math.ceil(played / 10)` — _rounds completed_ — while the hub and title bar show the round _about to be played_ | A one-line fix. Deferred twice, both times as "a screen this change was not asked to touch". Decide which of the two numbers is the right one and make both sites say it.                                                                                                                                                                                                                             |
| **Disabled-tile accessible name**                             | `HubScreen.tsx` — the label and milestone spans are adjacent with no separator, so a screen reader says `"CanteraM7"`                      | One attribute (`aria-hidden` on the badge; its `title` already carries the information). **Pinned by a test** that builds the expected name as `` `${label}${tile.milestone}` `` — the test changes with the fix. The identical defect in the hub's position band was already fixed, with a leading space.                                                                                            |
| **The overdraft has no teeth**                                | `board.ts` judges league position and nothing else                                                                                         | Recorded at M5b as a deliberate cost, not an oversight. A club may run to its limit and nobody mentions it. Debt becomes a consequence when there is something to attach it to.                                                                                                                                                                                                                       |
| **The harness's tactical blindness — partly closed**          | Every club still runs balanced tactics in 4-4-2 in `simulate.harness.test.ts`                                                              | The model grew a lever (`FORMATION_TEMPO`), so the sweep this row asked for was built: `simulate.formations.harness.test.ts` covers the formation gradient by club strength, the squad-shape preference, and the formation × slider interaction — the two now share the tempo channel and can stack. **Still open for the slider itself**, and the 50-season distribution bands remain balanced-only. |
| **Five breakpoints that do not agree**                        | 48, 52, 60, 64 and 68rem across the screen stylesheets, with no shared token — and **`App.css` has none at all**                           | Six screens use 60rem, Lineup 64, Hub 68, Setup 52, Player 48 and 60, Squad none. They were each picked where a two-column grid happened to break, which is defensible per screen and incoherent across ten. A `--fm-break-*` token set would make them one decision. Surfaced while moving the action bars; nothing depends on it being fixed.                                                       |
| **The title bar cannot reflow**                               | `.shell__bar` is a non-wrapping flex row and `.shell__title` is `flex: 1` with **no `min-width: 0`**                                       | So the bar overflows rather than wrapping when narrow — the shell chrome is the one part of the app with no responsive handling whatsoever. The footer added below it wraps; the bar above it still does not. One declaration, but it changes how the title truncates and wants looking at.                                                                                                           |
| **The harness measures generated squads**                     | `TEST_CLUBS` ships no rosters and `domain` cannot import `@fm/data`, so `simulateSeasons` never passes them                                | Cost a real finding: formation measured "under 1.5 points" on generated squads and 5.4 on the real ones, and `docs/attribute-model.md` carried the wrong number for two milestones. `simulateSeasons` has no `rosters` passthrough; adding one widens a signature every calibrated band flows through.                                                                                                |
| **`TableScreen`'s "Últims resultats" is a weaker copy**       | It reads `store.feed` — capped at 60 and cleared on load — while `ResultsScreen` reads `season.fixtures`                                   | Now that a real results screen exists this panel is the second, worse answer to the same question, and this project has repeatedly been bitten by the weaker of two copies winning the click. Left alone because removing it was not what the results work was asked to do. Decide it deliberately.                                                                                                   |
| **The results grid pushes the page 14px at a 500px viewport** | `.results-screen` at the narrow breakpoint; the classification and the squad contain themselves at the same width                          | Measured, not assumed. 500px is Chrome's minimum window and about half the 960px every screen's breakpoint targets; everything from 900px up is clean — no page scrolls sideways and nothing lands outside the viewport. Neither `min-width: 0` on the scroller nor an explicit `overflow-x: hidden` moves it, so the cause is further up the shell.                                                  |

---

## Decision log

Locked decisions live in [`docs/adr/`](./adr/). Read them before reopening a settled question.

| ADR                                         | Decision                                                      |
| ------------------------------------------- | ------------------------------------------------------------- |
| [0001](./adr/0001-workspace-tooling.md)     | pnpm workspaces, no Turborepo                                 |
| [0002](./adr/0002-prng.md)                  | `sfc32` seeded PRNG                                           |
| [0003](./adr/0003-league-format.md)         | 20 clubs, 38 rounds, Spanish tiebreakers                      |
| [0004](./adr/0004-attribute-model.md)       | Eight attributes, not thirty                                  |
| [0005](./adr/0005-persistence.md)           | IndexedDB + JSON export, versioned saves                      |
| [0006](./adr/0006-typescript-6-not-7.md)    | TypeScript pinned to 6.x — typescript-eslint caps at `<6.1.0` |
| [0007](./adr/0007-intellectual-property.md) | Copy the design, not the expression or the name               |
| [0008](./adr/0008-target-pc-futbol-5.md)    | PC Fútbol 5.0 is the v1 target; 2001 is the direction         |
| [0009](./adr/0009-the-ledger-identity.md)   | Money is accounted for, not conserved                         |
| [0010](./adr/0010-real-squad-shapes.md)     | Real squad shapes, and altered surnames                       |
