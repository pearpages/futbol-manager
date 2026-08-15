# ADR 0010 — Real squad shapes, and altered surnames

**Status:** accepted · 2026-08-15
**Supersedes:** [ADR 0007](./0007-intellectual-property.md) decision 4, in part

## Context

[ADR 0007](./0007-intellectual-property.md) decided that default content is fictional:
clubs named for their city, players generated from Spanish name pools. It said this
plainly and it said why:

> **4. Default content is fictional.** … This is the constraint that actually carries
> risk, and it exists because club and player identity belongs to third parties who
> have nothing to do with Dinamic. It is not a stylistic preference and should not be
> relaxed for convenience.

It also left one thing open, deliberately:

> **What the data layer may _ship_ is not decided here.** The roadmap assumes real
> names arrive as a user-supplied import, but the difference between shipping a
> _format_ — an importer that reads a file the user provides — and shipping _data_ is
> a real decision with real consequences.

That open question has now been answered, and answered further than the ADR
anticipated: the data layer ships data, and the data is derived from real squads.

**The prompt was that the generated league had no texture.** Every squad was 23
players on a flat depth curve with ages drawn from the same triangular distribution,
so every club looked like every other club with the numbers moved. Real squads are
lumpy — a 39-year-old on the last contract of his career, a 22-year-old worth more
than the rest of the XI put together, a club with four strikers and no left-back.
That lumpiness is most of what makes a squad screen worth reading.

## Decision

**1. Squad shape comes from real rosters.** Positions, ages, squad sizes and the
ordering of players within a position group are taken from real squads. What this
does _not_ change is anybody's quality: `calibrateSquad` still collapses each finished
squad onto the club's `attack`/`defence`, so a roster supplies the shape and the club
rating supplies the level. The `value` column ranks players inside a position group
and is never read as money.

**2. Surnames are lifted and altered.** Given names are kept as they are — an ordinary
Spanish given name identifies nobody. Each surname is changed by a one or two
character edit that stays inside Spanish orthography.

**3. The alteration ran once, offline, and only its output is committed.** There is no
mutation function in the codebase and no list of real surnames, because shipping the
function alongside the input would put the real names in the repository — the outcome
the alteration exists to avoid. `packages/data/src/rosters.ts` is the only artefact.

**4. ADR 0007's club half stands, unchanged.** Clubs remain their cities. Nothing here
touches club names, crests or kit — `badges.ts` still says what it says.

**5. The name pools stay.** `PLAYER_NAMES` still names youth intake and free agents at
every rollover, so a career drifts away from the opening rosters on its own. Only the
twenty opening squads are seeded from real data.

## The risk this accepts

Recorded plainly, because ADR 0007 was right that this is the decision that carries
risk and a superseding ADR that soft-pedals it would be worse than no ADR.

- **An altered surname does not remove the identification.** The player keeps his
  club, his age, his position and his place in the squad's value order. Anyone who
  follows the league will recognise most of the front page of most squads. A
  one-letter edit is not anonymisation and should not be described internally as
  though it were.
- **The deliberate near-miss is itself evidence.** A generated name is independent
  creation; a name that is one character away from a real player's is a derivative of
  it, and the near-miss is easier to characterise as copying than as coincidence.
- **Bulk extraction engages a separate right from the naming question.** The source's
  terms of use prohibit automated extraction, and the EU sui generis database right
  (Directive 96/9/EC) protects substantial extraction from a database that took
  substantial investment to build. Roughly five hundred rows across twenty clubs is
  not a thin extraction. This is true independently of what the names are changed to,
  and it is a second exposure rather than the same one restated.
- **The verification cannot be re-run in the repository.** At generation time, 427
  distinct real surnames produced 427 distinct altered ones with zero collisions
  against the real set. That check needed the real list, so it cannot be a test here.

**This was the project owner's decision, taken with the above stated.** The objection
was raised twice before the work started and the answer did not change. It is recorded
here because the repository must not assert one rule in `CLAUDE.md` and do another in
`packages/data`.

As with ADR 0007: **this is a considered engineering position, not legal advice.**
A public or commercial release would want a real review, and this decision is the one
most likely to be reversed by that review. Reversing it is cheap by construction —
`rosters.ts` is one file and the generator falls back to name pools when a club has no
roster, which is the path `TEST_CLUBS` and every domain test already take.

## Consequences

- `packages/data/src/rosters.ts` ships ~509 players across the twenty clubs. Clubs
  outside the league carry no roster.
- `generateSquad` takes an optional `roster`. Absent, it generates exactly as before,
  so **no existing behaviour changed for anything that does not pass one**.
- **The statistical harness still runs on generated squads**, because `TEST_CLUBS`
  ships no rosters and `domain` may not import `@fm/data`. That is a real gap: the
  bands no longer measure precisely the squads the game ships. It is covered by
  `packages/data/src/rosters.test.ts`, which asserts the round trip within ±3 (it
  measures ±1), that every formation is playable, and that ages land in the band the
  market harness assumes. If that proves insufficient, the fix is to mirror the
  rosters into `domain` the way `TEST_CLUBS` mirrors `CLUBS`.
- Squad sizes are now 19–29 rather than a flat 23, which exercises `MIN_SQUAD` and
  `MAX_SQUAD` in a way the generated league never did.
- `CLAUDE.md`, `docs/roadmap.md`, `docs/attribute-model.md` and `names.ts` all
  asserted "never lift a real squad". They now point here instead.
