# ADR 0009 — Money is accounted for, not conserved

**Status:** accepted · 2026-08-14

## Context

From M4a until M5a, money in this league was a **closed quantity**. `totalBudget` was 27,854k on the first day of a career and 27,854k on the last; a transfer moved it between two clubs and nothing anywhere created or destroyed a unit. That was written down twice as an invariant not to be touched — [`market-model.md`](../market-model.md) lists it under "Balance invariants — never loosened without a very good reason", and the roadmap's M4a entry says outright that it is "never to be loosened". Six assertions across three test files enforced it.

It was the right invariant for a milestone with no income, and it caught real bugs: a fee credited to a seller without being debited from a buyer inflates the league silently and only shows up years later as squads going strange.

**M5 cannot keep it.** The milestone exists to replace a one-time allowance with an income — its own framing is that money only moving between clubs is a _ratchet_, and revenue is what makes it a _cycle_. Measured over a decade, the three richest clubs finished holding 21.5M of the league's 27.9M while the poorest were down to single-digit thousands, at which point a small club can no longer buy anybody. Revenue creates money; wages and signing bonuses destroy it. Under those rules a constant total is not a property worth having.

The risk was doing that quietly — dropping a test labelled "never loosen this" and leaving nothing in its place, which is exactly how a class of bug that took a milestone to find gets reintroduced.

There is also no ADR covering the economy at all. Every money decision so far lives in milestone prose and in one document's bullet list, which is part of why an invariant with that much weight behind it was easy to walk into.

## Decision

**The conservation invariant is replaced by a ledger identity of greater strength, not removed.**

Every club carries a `ledger` of the current season's movements — gate, TV, sponsorship, prize, transfers, wages, bonuses, interest — and a `lastLedger` holding the season just closed. The invariant is:

```
Δbalance  ===  ledgerNet(after) − ledgerNet(before)
```

on **every tick**, for **every club**. Nothing may move a balance without writing the line that explains it.

Three consequences follow, and all three are deliberate:

- **It is stricter than what it replaced.** The old test could only say that the league as a whole had inflated. This one says which club, on which line, on which day.
- **It is checked per tick rather than per season.** A season-level check would let an error appear and cancel out inside the same year.
- **`lastLedger` exists because of it.** Prize money lands in the same step that clears the season's ledger, so without somewhere to put the closed accounts there would be a hole in the identity exactly where the money moves.

**A club may go into debt, down to a limit proportional to its own annual income.** A flat overdraft is pocket change to the richest club and fatal to the poorest, which would make "no club goes bankrupt" a statement about one club rather than about the league. Interest is charged monthly while a balance is negative.

**The AI never borrows to buy.** It spends only a positive balance. Debt is therefore something a club drifts into through wages outrunning income — the failure the exit criterion is actually hunting — rather than something it chooses. Letting the AI spend into its overdraft too would put two causes behind one symptom.

**Nothing on the money path may draw randomness.** Finance runs inside `AdvanceDay`, which is the path every calibrated distribution band in this project is measured through; one `rng.next()` there shifts every downstream draw and moves every band at once. Attendance is therefore a function of quality and league position rather than a draw — which is also the more legible model, since a crowd is not a coin flip. `pnpm season` staying byte-identical across this milestone is the proof that the rule held.

## Consequences

**A surplus needs a brake, and the brake is wage inflation.** This was not obvious and cost most of the milestone's tuning. A fixed positive margin compounds without limit, because the league's only other outflow is the signing bonus — and AI transfer volume falls to nothing once squads converge, measured at zero from about season fifteen. A constant leak cannot balance a proportional inflow. So the outflow grows with the pile: a club holding more than a healthy reserve pays over the odds for its players, which is both what happens in football and a cost the game already models. Without it the league grew 36× over fifty seasons; with it, it plateaus.

**The premium taxes the excess, not the balance.** Taxing the whole balance vaporised four fifths of the league's money in the first season and would have quietly undone M4b's calibration that a budget buys two players of a club's own standard. A reserve is not a fortune.

**Income has to be as convex as wages.** Wages scale roughly as `rating^3.5`; income modelled naively scaled as `rating^2.8`. Rescaled uniformly, that bleeds the big clubs and enriches the small ones — inverting the table within a few seasons, which is the failure `seedBudget`'s own comment warns about. Gate and sponsorship carry the convexity; the equal share of TV money is the floor that keeps a struggling club solvent.

**`seedBudget` survives as an opening balance.** The roadmap says revenue replaces the seed, and it does — as the ongoing source. The seeded figure stays as the day-one position because it is calibrated and pinned by the human market harness. Replacing the seed and the income together would have moved two things and left nothing to measure the result against.

**Anything that adds a way for money to move must add a ledger line.** `LEDGER_KEYS` is written once and the identity iterates it, so a ninth line cannot be added and silently left out of the sum — there is a test for exactly that. This is the rule M6's training costs and M7's continental prize money inherit.
