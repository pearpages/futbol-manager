# Market model

How the transfer market decides things. [`attribute-model.md`](./attribute-model.md) is the spec for what a player _is_; this is the spec for what he is _worth_, who will sell him, and when.

The market is a **scoring function, not a rule tree** — the roadmap is emphatic about it, because rule trees in transfer markets produce clubs that stockpile goalkeepers. Almost everything below follows from one number.

---

## The need score

`needFor(squad, candidate)` in [`packages/domain/src/market.ts`](../packages/domain/src/market.ts) is that number. It is the same function the AI market runs on — not a display-only calculation.

The formula is a marginal difference:

```ts
export function needFor(squad, candidate) {
  const before = ratingOf(squad)
  const after = ratingOf([...squad, candidate])
  return after - before
}
```

`ratingOf` picks the best XI in 4-4-2, collapses it through `teamRating`, and returns `attack + defence` summed. So a score of **6** means: if this player were in your squad, your strongest eleven's attack and defence ratings would total six points higher than they do now.

### Zero is the normal answer, not a bug

If he would not displace anyone in your best XI he adds nothing, however good he is in the abstract — he would sit on the bench. A title-challenging club scores **zero on every player in the league**, and that is correct rather than broken.

It is also why the market needs no rule against stockpiling goalkeepers. A second good keeper cannot enter the XI, so he scores zero on his own; the behaviour a rule would have enforced falls out of the scoring instead. **Do not add a cap** — a cap would hide exactly the bug the milestone exit criteria hunt for.

### It always evaluates in 4-4-2

Whatever formation you actually play. This is deliberate: comparing every candidate under one fixed shape keeps the score about the player rather than about a formation change. The cost is that the number is an approximation if you play 4-3-3 or 3-5-2 — a winger who would start in your 4-3-3 may score zero against a 4-4-2 reference.

### It used to be a whole number, and that was a trap

`teamRating` runs `clampRating`, which rounds — so for a long time `needFor` subtracted two rounded integers and could never return 3.4. Four thresholds written as distinct fractions therefore collapsed onto two integer cutoffs, and looked far more tuned than they were.

**`teamRatingRaw` returns the pair unrounded and `needFor` scores against that.** It is a separate entry point rather than an extra field, because `teamRating` is hot enough that returning a nested object on every call pushed the tactics harness past its timeout. The thresholds below mean what they say. This was forced by the rescale: compressing the scale shrank every marginal gain, so under rounding far more candidates would have scored zero and the AI would have quietly stopped trading — with no harness band to catch it, because none asserts deal volume.

**This matters for tuning.** Four thresholds are written as fractions and collapse to two cutoffs:

| Constant                | Where       | Written | Actually means |
| ----------------------- | ----------- | ------- | -------------- |
| `RETAIN_THRESHOLD`      | `season.ts` | 0.5     | 0.5            |
| `NEED_THRESHOLD`        | `market.ts` | 0.5     | 0.5            |
| `LISTED_NEED_THRESHOLD` | `reduce.ts` | 0.5     | 0.5            |
| `OFFER_NEED_THRESHOLD`  | `reduce.ts` | 1.0     | 1.0            |

Nudging one by a tenth is now a real change, which it was not before.

**`VALUE_FOR_MONEY` moved by more than the rescale factor** — 0.0016 to 0.0003 — and the reason is worth knowing. It caps what the AI pays per point of improvement, and it only ever bought at the cheap end. Raising the rating floor from 27 to 60 removed the cheap end: there are no bad players any more, so there are no bargains, and the bottom of the market roughly doubled in price. Measured after the rescale, only 2 of 158 positive-need candidates still cleared the old figure.

### Three call sites, asked in both directions

- **`runTransferWindow`** — would this club be improved by that player?
- **`rolloverSeason`** — does his own club still want him? Below the threshold his expiring contract is not renewed and he leaves as a free agent.
- **`bestOfferFor`** (in `reduce.ts`) — does an AI club want one of _your_ spare players enough to make an offer?

### It is deliberately not shown to the player

The market screen carried an "Improves" column until M4c. It made squad-building a lookup: read the top row, buy it. The number still drives every AI decision; the player has to judge for himself from position, age, quality and price, and the listing order is shuffled so the best players are not conveniently at the top either.

**One consequence worth remembering when reading the harness:** `market.human.harness.test.ts` measures a manager whose shopping strategy calls `needFor` directly. Its **+4.3 points a season** is therefore a _perfectly informed_ manager — an upper bound on what the screen makes reachable, not what a person will get.

---

## What a club will sell

**There are two rules, and which one applies depends on whether a person is watching.**

### An AI club — `surplus(squad)`

Everyone who is not in the best XI **and** can be spared, meaning that removing him still leaves at least one cover at every position. A club at or below `MIN_SQUAD` (18) sells nobody.

The floor is the deeper of two numbers: `shape + 1` in the 4-4-2 reference, which is the "one cover beyond the XI" intent, and `DEEPEST_BANK` from `lineup.ts`, which is the most any formation asks for at that position. Until the second batch of formations arrived the first alone happened to satisfy every shape, and this file said so; 4-2-4 wants a fourth forward, which made that quietly false and put 19 of 200 squad-seasons out of reach of a formation the screen was offering. **`DEEPEST_BANK` is derived from `FORMATIONS`, so adding a shape cannot break this again.**

The reference shape is 4-4-2 whatever the club plays — the same fixed-shape approximation `needFor` makes, and harmless for a club nobody watches, since every AI club is on 4-4-2 anyway.

### The manager — `saleBlock(squad, lineup, player)`

Two clauses and no others:

- **He is in the XI you picked.** Not the best XI, not a 4-4-2 XI — the team sheet as it stands.
- **He is a goalkeeper and you would be left with one.** `COVER_KEEPERS` is 2. The keeper carries 35% of the defensive rating alone, and from M6 an injury to a lone keeper leaves a squad unable to field a legal XI at all.

**There is no squad-size floor and no outfield depth floor for the manager**, and neither is needed for safety: refusing to sell a starter means eleven legal players with exactly one keeper always survive, whatever else goes. He may sell below 18 if he wants to; that is his business, and `LineupScreen` simply stops offering a shape his squad can no longer fill.

**This used to be `surplus` for both, on the argument that one rule beats two.** It was wrong for a person, and visibly so. Judged against 4-4-2, a bench player in the manager's own 4-2-4 was refused as "in your first team" while the row beside the button read "not selected" — a contradiction on one line, with no way to act on either half. Measured before the change: one such row per club on most shapes, two per club on 4-2-4, plus 14 reserve goalkeepers and 3 midfielders across the league blocked by the depth floor and given the same wrong sentence.

`sellable` derives from `saleBlock` rather than restating it, so the sentence the Plantilla screen shows and the code the reducer throws cannot drift from what is enforced.

**Five places ask the manager's rule and must stay in step:** `SquadScreen`, `ListPlayer`, `RespondToOffer`, `bestOfferFor` and — the one that is easy to miss — the **seller-side re-check inside `runTransferWindow`'s buy loop**. That gate applies to the human for anything he listed; left on `canSpare`/`MIN_SQUAD` it silently vetoes deals the screen and the reducer have both already allowed, with no refusal and no event. The player simply never moves.

Starters are never for sale, at any price, under either rule. That is the whole of it; there is no separate "not for sale" flag.

**Your own club is invisible to the AI market**, in both directions, so nothing you own is ever in front of a buyer. `transferList` is how you opt one player back in — see below.

---

## What a player costs

In [`valuation.ts`](../packages/domain/src/valuation.ts), all figures in **thousands**.

```
playerWorth = 1200 × quality^3.2 × ageFactor × positionScarcity
valuePlayer = playerWorth × contractFactor
askingPrice = valuePlayer × 1.35
expectedWage = playerWorth × 0.22        (floor 50)
```

- **Quality is steeply convex** (`^3.2`). Only the top of the market wins you anything; a linear curve would make squad-filling as efficient as star-buying.
- **Scarcity is measured, not tasteful.** `GK 1.45`, `FW 1.1`, `DF 1.0`, `MF 0.95` — a goalkeeper carries 35% of a team's defensive rating on his own, so pricing on `overall` alone would systematically underprice keepers and a human would empty the league of them.
- **A fee and a wage move in opposite directions as a contract runs down.** `valuePlayer` applies `contractFactor`, which falls to zero at expiry — six months left and he walks for free, so nobody pays a fee. `expectedWage` deliberately does **not**: a player out of contract wants more, not a token. Deriving both from one number was a real bug — every renewal and every free agent came out on the 50 floor.

---

## When

`isTransferWindowOpen` — **July, August and January**. Nothing is bought or sold outside one.

The season runs from 15 August to May, and `StartNewSeason` jumps straight to the next 15 August, so the day clock **never reaches 1 July or 1 August**. Anything scheduled on those dates silently never happens; this cost a milestone once.

- The **AI window** runs once, inside `StartNewSeason`, after the rollover.
- **Your bids** are answered `ANSWER_DAYS` (2) after they are made.
- **Offers for your players** are generated on Mondays while a window is open, and lapse after `OFFER_LIFETIME_DAYS` (7) if you ignore them.

**The whole bid subsystem draws no randomness**, and that is a requirement rather than a style: it runs inside `AdvanceDay`, which is the path every calibrated distribution band in the project is measured through. One `rng.next()` there moves every band. See the note at the top of [`bids.ts`](../packages/domain/src/bids.ts).

---

## Who is available

**Listed by another club** — anyone in that club's `surplus`. Bid, wait, and if the fee is agreed, agree personal terms separately. A fee buys the right to talk to him; he still has to want to come.

**Free agents** — released at rollover when their own club no longer needs them. No fee, only wages, which is the route into the market for a club that cannot pay one. The pool is persistent: unsigned players stay in it and leave only by retiring. Deleting them each summer drained it to nothing by season six and froze the market.

**Your transfer list** — `ListPlayer` puts one of your spare players in front of AI buyers. Spare only, re-checked at window time, so a player listed in August who has won his place back by January is not sold out from under you. **Listing is the consent**: a listed player who attracts a buyer is sold without a further prompt.

---

## Keeping one

`RenewContract` is `OfferContract` with the transfer taken out: no fee, no `applyTransfers`, no money moves at all. What it keeps is the negotiation — the same `offerTerms` a signing goes through, so he can refuse the wage or the length, and a refusal is an event with the state untouched rather than a throw.

Three clauses differ from a signing, and each is deliberate:

- **No transfer window.** A deadline protects the club you would be buying from, and there is no such club. The rollover judges his deal whether or not a window is open, so gating the only answer to it on a window would make the flag on the squad screen unactionable for most of the year.
- **He must already be yours.** The inverse of `OfferContract`'s `error.player.yours`.
- **The new deal may not be shorter than the old one.** With renewal available at any moment, one year offered to a man contracted for four would quietly cut three off him. That is a slip, not a decision.

**The rollover rule is unchanged, and the manager is still subject to it.** Reach the summer having done nothing and `rolloverSeason` renews whoever the club still needs by `RETAIN_THRESHOLD` and lets the rest walk — for your club exactly as for the other nineteen. What changed is that it is no longer silent: `ContractExpiring` names each deal half a year out, and `PlayerReleased` / `PlayerRetired` say who actually went. Those are derived by diffing the squad either side of `rolloverSeason` inside `StartNewSeason`, **before `runTransferWindow` runs in the same handler** — after it, anyone the AI bought from you counts as released.

**The fee arbitrage is real and self-limiting**, which is why there is no rule against it. `contractFactor` is 0.25 under six months and 1 above two years, so renewing a run-down player multiplies his asking price by exactly **4×** — measured. But the AI buys on `VALUE_FOR_MONEY`, which is need divided by fee plus wages, so the same 4× makes him _harder_ to sell: across a mid-season league, candidates clearing the filter fell from **4 before renewal to 2 after**. Buying cheap, renewing and selling on shrinks your market rather than growing it. Re-measure before adding a rule; do not add one on the reasoning alone.

---

## What a club earns

In [`finance.ts`](../packages/domain/src/finance.ts), all figures in **thousands**. Added at M5a, when money stopped being a fixed allowance.

| Line              | When                     | Driven by                                  |
| ----------------- | ------------------------ | ------------------------------------------ |
| **Gate**          | each home match          | capacity × occupancy × ticket price        |
| **TV**            | monthly                  | 30% shared equally, 70% on league position |
| **Sponsorship**   | monthly                  | club rating, convexly                      |
| **Prize**         | at the rollover          | final position, on a geometric ladder      |
| **Wages**         | monthly                  | the squad's contracts, × the wage premium  |
| **Signing bonus** | on a transfer            | 10% of the fee, paid to the player         |
| **Interest**      | monthly, while overdrawn | the overdrawn amount                       |

Four things about this are not obvious from the signatures:

- **Income is convex on purpose, and has to be.** Wages scale roughly as `rating^3.5` because player value does. Income that scaled more gently would bleed the big clubs and enrich the small ones, inverting the table within a few seasons — the exact failure `seedBudget`'s comment warns about. **Sponsorship is now the only line that carries that convexity.** The gate used to, while capacity was a curve on rating; real grounds ended that, and a stadium is now an idiosyncratic fact about a club rather than a restatement of how good it is. Which leaves the three lines doing three different jobs: **sponsorship tracks the squad, the gate rewards an inherited ground, and TV is the flat floor** that keeps a good club with a small stadium solvent and stops the money pooling at the top.
- **The wage premium is the brake on the whole economy.** A club holding more than a healthy reserve pays over the odds. Without it a fixed surplus compounds forever, because the only other outflow is the signing bonus and AI transfer volume falls to zero once squads converge — measured at 36× league growth over fifty seasons. It taxes the _excess_ over the reserve, never the whole balance: taxing the balance vaporised four fifths of the league's money in season one.
- **TV merit keys off the current table, not last season's.** An approximation, taken so last season's finishing order need not be carried as state. In August nothing has been played and everyone takes the flat share.
- **Nothing here draws randomness.** Attendance is a function of quality and position, not a draw. See the invariants below.

---

## Balance invariants

Never loosened without a very good reason, and each has a test:

- **Money is accounted for.** Every movement writes a ledger line, and a club's balance changes by exactly what its ledger says — checked per club, on every tick. This **replaced "money is conserved"** at M5a, when revenue started creating money and wages started destroying it; it is the stricter of the two, because the old one could only say the league had inflated while this one says which club and on which line. See [ADR 0009](./adr/0009-the-ledger-identity.md).
- **A club may go into debt, but not past its limit**, which is a fraction of its own annual income rather than a flat figure. The AI never borrows to buy, so debt is always something a club drifted into rather than chose.
- **Nothing on the money path draws randomness.** Finance runs inside `AdvanceDay`, the path every calibrated band is measured through. `pnpm season` staying byte-identical is the check.
- **Every AI squad stays between 18 and 30**, as a consequence of needs decaying rather than a cap. Releases stop at `RELEASE_FLOOR` (21) rather than `MIN_SQUAD` — draining to the legal minimum froze the market, because `surplus` returns nothing at 18. **The manager is not held to this** and may sell below 18; what holds for him is that he always keeps a fieldable XI and a cover keeper.
- **Every AI squad can field a legal XI in every formation**, which is why sales are re-checked against the squad as it stands rather than as it stood when the window opened. The manager keeps a legal XI by construction — a starter cannot be sold — but may sell his way out of a _shape_, which the lineup screen then stops offering.
- **A budget buys roughly two players of the club's own first-team standard.** Below that the market is decorative: at the old seeding, 48 of 228 listings were affordable to a mid-table club and every one scored zero on need.
