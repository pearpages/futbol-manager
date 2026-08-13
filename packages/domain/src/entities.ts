import type { DayNumber } from './time.ts'

/**
 * Core entities. Everything is `readonly` — ground rule 2 means state is replaced,
 * never mutated, and the type system should say so rather than rely on discipline.
 */

export type ClubId = string & { readonly __clubId: unique symbol }
export type FixtureId = string & { readonly __fixtureId: unique symbol }

export interface Club {
  readonly id: ClubId
  readonly name: string
  /** Short form for tables, where 20 rows of full names do not fit. */
  readonly shortName: string
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
