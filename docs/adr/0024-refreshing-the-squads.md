# ADR 0024 — Refreshing the real squads

**Status:** accepted · 2026-10-05 · amends ADR 0010 (source and value of newcomers)

## Context

The opening rosters (ADR 0010) were shaped on the squads of August 2026. The summer
window closed with about seventy players moved in or out of the twenty clubs, so the game
opened with squads a month out of date. ADR 0010's source was a site whose terms forbid
automated extraction, an exposure it recorded and accepted. Refreshing from it would
repeat that exposure every season.

## Decision

1. **The source is Wikipedia:** each club's English article and its 2026–27 season
   article, read as raw page source, never a summary. The squad lists are CC BY-SA 4.0,
   reusable with attribution, which `rosters.ts` carries. First-team lists only: loans
   out, reserves and "other players under contract" are left out.
2. **ADR 0010's alteration stands**, applied offline, with only its output committed:
   - given names kept;
   - surnames changed by one vowel;
   - no altered name equal to a real one or to another player's.
3. **Merging, so a refresh moves no club's calibrated curve more than the squad did:**
   - a player still at his club keeps his committed row (name, position, age, `value`);
   - a player who moved between two of the game's clubs keeps his row and his name;
   - a newcomer gets his age at the season start and his club's median `value` for his
     position, since Wikipedia has no market values;
   - players under 16 are left out, and a newcomer with no recorded birth date is 19;
   - wingers fill whichever bank a formation would otherwise be short of.
4. **The formation harness measures a frozen snapshot of the August 2026 rosters**
   (`harness-rosters.ts`), not the shipped ones. Its effects are small and depend on who
   is in a squad, and the refresh flipped two of them with the model untouched. The model
   is calibrated against the snapshot; the shipped rosters keep their invariants in
   `rosters.test.ts`. No band changed (P9).

## Consequences

- A refresh is repeatable each window from an openly licensed source.
- A newcomer's `value` is his club's typical player at his position, not his real
  standing, so a star signing starts mid-pack inside his squad until a later refresh with
  better data.
- The harness no longer measures exactly the squads the game ships. A refresh that should
  move the model's calibration has to replace the snapshot deliberately.
