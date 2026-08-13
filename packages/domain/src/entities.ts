import type { DayNumber } from './time.ts'

/**
 * Core entities. Everything is `readonly` — ground rule 2 means state is replaced,
 * never mutated, and the type system should say so rather than rely on discipline.
 */

export type ClubId = string & { readonly __clubId: unique symbol }
export type FixtureId = string & { readonly __fixtureId: unique symbol }

/**
 * What the result resolver consumes, per side.
 *
 * This is the contract defined in docs/attribute-model.md. At M2 it came off the
 * club directly; from M3 it is computed from the starting XI. The resolver never
 * learns the difference — M3 replaced the supplier, not the signature.
 */
export interface TeamRating {
  /** 1–99. */
  readonly attack: number
  /** 1–99. */
  readonly defence: number
  /**
   * How open this side wants the game, −1 (low block) to +1 (all-out attack).
   *
   * Added at M3c. `attack` and `defence` describe how strength is *split*;
   * nothing described how many chances a game has, so a low block could not do
   * the one thing a low block is for. Lower tempo means fewer goals for both
   * sides, which means more draws — worth far more to the weaker team.
   *
   * Zero at balanced tactics, so the M2 calibration is untouched by default.
   */
  readonly tempo: number
}

export interface Club {
  readonly id: ClubId
  readonly name: string
  /** Short form for tables, where 20 rows of full names do not fit. */
  readonly shortName: string
  /**
   * **Provisional, M2 only.** Stands in for a squad until players exist. At M3
   * these stop being read: the rating is derived from the selected XI via the
   * position-weighted collapse in docs/attribute-model.md, and these fields become
   * a seed for squad generation rather than a live input to results.
   */
  readonly attack: number
  readonly defence: number
  /**
   * Transfer kitty, added at M4. Falls when the club buys, rises when it sells.
   *
   * Seeded from the club's rating, which is what keeps the table's shape stable
   * across a decade: if Almería could outspend Madrid the league would invert
   * within a few seasons. **M5 replaces the seeding** with money that actually
   * comes from somewhere — gate receipts, TV, prize money, minus wages.
   */
  readonly budget: number
}

export function clubRating(club: Club): TeamRating {
  return { attack: club.attack, defence: club.defence, tempo: 0 }
}

export interface Score {
  readonly home: number
  readonly away: number
}

export interface Fixture {
  readonly id: FixtureId
  /** 1-based, 1–38. */
  readonly round: number
  readonly date: DayNumber
  readonly homeId: ClubId
  readonly awayId: ClubId
  /**
   * `null` means unplayed. Deliberately nullable rather than optional: with
   * `exactOptionalPropertyTypes`, "absent" and "present but null" are different
   * types, and an unplayed fixture is a real state a save must round-trip — not a
   * missing field.
   */
  readonly result: Score | null
}

export interface Competition {
  readonly id: string
  readonly name: string
  readonly clubIds: readonly ClubId[]
}

export interface Season {
  /** e.g. 2026 for the 2026/27 season. */
  readonly startYear: number
  /** The day clock. Advanced only by the tick; never derived from wall time. */
  readonly currentDate: DayNumber
  readonly fixtures: readonly Fixture[]
}

export function isPlayed(fixture: Fixture): boolean {
  return fixture.result !== null
}
