# ADR 0003 — League format: 20 clubs, 38 rounds, Spanish tiebreakers

**Status:** accepted · 2026-08-13

## Context

M1 needs a concrete competition to generate fixtures for and compute a table from. The roadmap specified "a full 38-fixture season", which implies 20 clubs playing double round-robin, but never said so outright. Tiebreaker rules were left as an open question ("head-to-head before goal difference, if you want Spanish rules").

The game is explicitly in the spirit of PC Fútbol 2001, a Spanish product modelling La Liga.

## Decision

- **20 clubs, double round-robin, 38 rounds.**
- **Spanish tiebreaker chain**, applied in order:
  1. Points
  2. Head-to-head points (between the tied clubs only)
  3. Head-to-head goal difference
  4. Overall goal difference
  5. Goals for
- **One hardcoded competition.** Per ground rule 5, the fixture generator and table computation are written for this league, not for an arbitrary N.

## Consequences

- Head-to-head is a genuinely different computation from goal difference: it requires re-deriving a mini-table over the tied subset, and it must handle three-or-more-way ties. This is a real chunk of M1's work and its unit tests, not a one-line comparator.
- Ties that survive all five criteria are resolved by a deterministic, documented fallback (club id) rather than by the PRNG — a table must not shuffle between renders of the same state.
- The abstraction to N clubs, alternative tiebreaker strategies, and multiple competitions arrives in **M7**, where the second division and the cup are the real second case that ground rule 5 requires. Not before.
