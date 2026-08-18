# ADR 0011 — A market abroad

**Status:** accepted · 2026-08-18 · **decision 4 reversed the same day, see below**
**Relates to:** [ADR 0007](./0007-intellectual-property.md), [ADR 0010](./0010-real-squad-shapes.md)

## Context

The market had one supply of players: the twenty clubs in the division. Measured
over twenty seasons, that supply also _shrank_ — the league leaked players, squads
fell from 23 to 18.9, and the number of players available to buy anywhere fell from
234 to 60. Two separate pieces of work fixed the leak. This one answers the other
half of the same complaint: **there is nowhere else to shop.**

The project owner asked for international clubs, chosen and rated from
Transfermarkt: the six biggest of England, Germany, France and Italy and the two
biggest of Portugal, the Netherlands, Belgium and Türkiye. Thirty-two clubs.

The owner also asked, explicitly, for those squads to take **real shapes with
altered surnames**, as ADR 0010 did for the twenty Spanish squads.

## Decision

**1. Clubs abroad are a market source, not a competition.** They have squads,
budgets and a place in the transfer market in both directions. They have no
fixtures, no table, no lineup, no finances and no screen of their own. They live in
`GameState.foreign`, deliberately not in `state.clubs` — four loops in the reducer
iterate that array and one of them throws for a club with no lineup. Ground rule 5
still holds: the second competition is M7's, and this is not it.

**2. Nothing in the foreign layer draws from the main PRNG.** Every squad is
generated from a stream derived from the club id and the year. Seven hundred
players are built without spending a single draw, so `pnpm season` is byte-identical
and no calibrated distribution band moved.

**3. Club names follow ADR 0007's city convention, unchanged.** Where a city fields
more than one of these, the second takes its district or ground — Islington, Fulham
and Tottenham for London; Trafford beside Manchester; Navigli beside Milano. Where
the city name sits closer to a club's trading name than any Spanish case does
(Napoli, Porto, Torino), the mitigation is the **local-language form**, which the
convention already applies to Sarrià and Girona.

**4. Foreign squads take real shapes with altered surnames, as the domestic
twenty do — ADR 0010 decision 1, applied abroad.** Positions, ages, squad sizes and
the value ordering inside each squad are taken from real squads; every surname is
altered by a one- or two-character edit; given names are kept.

**This decision was written the other way round first, and reversed the same day.**
The original text and the reasoning that was wrong are kept below rather than
deleted — a decision log that quietly edits itself is worth less than one that
shows where it changed its mind.

**5. Club ratings are derived from squad market value on the same curve as
`CLUBS`,** anchored to the shipped domestic scale. The values are approximate and
were **not scraped** — see below.

## Why decision 4 was reversed

**What it originally said**, and the reasoning, verbatim in substance: ADR 0010
accepts a bounded exposure — ~509 players, twenty clubs, one source, one file,
cheap to reverse — and lists as a _separate_ risk that

> **Bulk extraction engages a separate right from the naming question.** The
> source's terms of use prohibit automated extraction, and the EU sui generis
> database right (Directive 96/9/EC) protects substantial extraction from a
> database that took substantial investment to build.

Doing the same abroad would take that to ~1,200 rows against eight more sources,
which is a materially larger exposure rather than the same one repeated. And a
practical fact was said to settle it independently: **the source is not reachable**
— Transfermarkt cannot be fetched by this project's tooling, and its terms prohibit
automated extraction in any case.

**The database-right half of that argument was about Transfermarkt, and the source
is not Transfermarkt.** Names, positions and dates of birth here come from
**Wikipedia's season articles**, which are CC BY-SA and whose squad tables are
plain facts. The anti-extraction terms do not apply, the sui generis argument is
far weaker against a freely-licensed encyclopedia, and "not reachable" is simply
false of it — thirty-one of the thirty-two squads were read straight from it.

So the refusal rested on a source that turned out not to be the source, and the
project owner reversed it.

**What has _not_ changed, and must not be softened.** ADR 0010's own statement
still holds in full and applies here identically:

> **An altered surname does not remove the identification.** The player keeps his
> club, his age, his position and his place in the squad's value order. Anyone who
> follows the league will recognise most of the front page of most squads. A
> one-letter edit is not anonymisation and should not be described internally as
> though it were.

Nor does the deliberate near-miss stop being easier to characterise as copying
than a generated name would be. **Altering the names is not what makes this
acceptable** — the change of source is what removed the argument that was actually
made against it, and the residual exposure is the same _kind_ as ADR 0010 accepts,
at roughly 2.4× the rows. That is what is being accepted, with the owner's
decision taken knowing it.

Reversal stays cheap by construction: `generateSquad` falls back to a generated
squad for any club with no roster, and the per-country name pools in
`names-intl.ts` remain — deleting one file returns the foreign league to generated
names.

## What was verified, and what was not

- **Names and positions**: read from Wikipedia season articles for **31 of 32**
  clubs. Anderlecht's article does not expose its squad section to the tooling;
  that one squad is supplied and is marked as such in `foreign-rosters.ts`.
- **Ages**: from the same tables where they carry a date of birth, and supplied
  where the article lists a squad without one.
- **`value`**: approximated throughout. **No free source carries market values**,
  and it is not a price — `valuation.ts` prices from the finished attributes. It
  is a shape parameter, and the file says so.

## What the ratings are, and are not

`FOREIGN_CLUBS` carries a squad market value per club, mapped to a rating by
`51.85 + 4.966 × ln(value in €m)` — the same log curve `CLUBS` uses, re-anchored so
Madrid's ~€1.45bn is 88 and Málaga's ~€39m is 70.

**The values are approximate and were not scraped.** They are the well-known order
of these leagues to the nearest plausible figure, which is all a rating curve needs.
Thirty-two numbers used to seed a curve are not a reproduction of a database, and
they are the sort of figure any football supporter could supply from memory.

## Consequences

- Schema **v9 → v10**. The migration writes an **empty** foreign layer and invents
  nothing, matching `v8ToV9`'s refusal to fabricate a palmarés. An existing career
  keeps the market it started with.
- An empty layer is a fully legal, playable state — every path iterates
  `foreign.clubs` and does nothing for an empty array. That is what lets every
  existing harness go on measuring a division with no foreign market in it, and
  what keeps this free of conditionals elsewhere.
- **Foreign squads are measured against the whole game's value norm**, domestic
  rosters and foreign pooled, rather than against each other. Thirty-two of the
  richest clubs in Europe have no cheap tail, so a norm taken from them alone makes
  every position's spread identical and a first-choice goalkeeper read as big a
  star as a €120M forward: measured, the top-rated player was a keeper at **22 of
  32 clubs abroad against 4 of 20 at home**. Pooling takes the clear cases from 13
  to 7. **It is applied one-sided** — `generateLeagueSquads` still computes its own
  from the domestic rosters, so the twenty Spanish squads are byte-identical and no
  calibrated band moves. A residual difference remains and is a known cost of
  selecting only elite clubs; the lever is the `value` column, never the code.
- **A club abroad offers only `FOREIGN_LISTINGS` fringe players per window.** Not
  tidiness: offering their whole `surplus` made the domestic league a net importer
  of players and a net exporter of cash, because these are the strongest clubs in
  Europe and their need for a mid-table Spanish player is zero. At one the flow is
  two-way and the net is under 4% of the league's money. The manager is not held to
  this — he can bid for anyone abroad through the club browser.
- `TEST_FOREIGN_CLUBS` mirrors the shipped list's _shape_ in `domain`, which cannot
  import `@fm/data`. **Change one and change the other**, as with `TEST_CLUBS`.
- A save grows by roughly 700 players.

As with ADR 0007 and ADR 0010: **this is a considered engineering position, not
legal advice.**
