# ADR 0025 — Club ratings follow the league's results

**Status:** accepted · 2026-10-05

## Context

Club ratings were set in August 2026 from the clubs' market values. By October the league
said otherwise: Barcelona won 2025–26 with 95 goals for and 36 against and lead 2026–27,
yet Madrid was rated above them. Ratings are load-bearing: they seed budgets, order the
clubs (strongest first, which fixture generation and many tests rely on), and the domain's
harness bands were calibrated on them.

A first attempt dealt attack and defence out separately, by goals scored and goals
conceded. That produced lopsided clubs (Getafe 71/84, Racing 76/69) the model was never
calibrated for, and broke twelve tests including the economy and market bands.

## Decision

1. **The stats decide the order; the calibrated ratings keep the scale.** Clubs are ranked
   by goal difference per match over 2025–26 and 2026–27 so far (Wikipedia's league
   tables). They then receive the league's existing twenty rating pairs in that order, so
   the spread, the budgets and the strongest-to-weakest gap are unchanged.
2. **A promoted club**, with no top-flight season to blend, starts from last season's
   bottom six weighted as a full season, plus its games so far.
3. **The domain's `TEST_CLUBS` stays frozen at the August league**, like the formation
   harness's rosters (ADR 0024). It holds the same twenty pairs, so the model's calibration
   is untouched. The shipped list is checked by the data tests.
4. **Ratings are two numbers, attack and defence.** How strong a club is in midfield comes
   from its squad: players' `value` within each position, and who starts.

## Consequences

- Barcelona is first (89/87) and Madrid second (87/88). Atlético and Villarreal follow;
  Bilbao and Valencia drop into the lower half; Racing is last.
- A re-ranking can be repeated each season from public tables.
- Tests that picked "a mid-table club" by its index in the list now meet a different
  club. The ones that depended on that club's particular squad were made to state what
  they need instead.
