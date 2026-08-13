import type { Club, ClubId, Competition, Fixture, Season } from './entities.ts'
import type { Lineup, Tactics } from './lineup.ts'
import type { Player } from './player.ts'
import type { DayNumber } from './time.ts'

/**
 * The complete game state. Everything the simulation needs to resume identically
 * lives here — this is what `persistence` wraps in a versioned envelope alongside
 * the PRNG state.
 */
export interface GameState {
  readonly clubs: readonly Club[]
  readonly competition: Competition
  readonly season: Season
  /** Squad per club. Added at M3; the v1→v2 migration generates them for older saves. */
  readonly squads: Readonly<Record<string, readonly Player[]>>
  /** Selected XI and tactics per club. AI clubs are re-picked from `bestXI` each matchday. */
  readonly lineups: Readonly<Record<string, Lineup>>
  readonly tactics: Readonly<Record<string, Tactics>>
}

export function clubIds(state: GameState): readonly ClubId[] {
  return state.competition.clubIds
}

export function fixtures(state: GameState): readonly Fixture[] {
  return state.season.fixtures
}

export function currentDate(state: GameState): DayNumber {
  return state.season.currentDate
}

export function squadOf(state: GameState, clubId: ClubId): readonly Player[] {
  return state.squads[clubId] ?? []
}

/** True once every fixture in the season has a result. */
export function isSeasonComplete(state: GameState): boolean {
  return state.season.fixtures.every((f) => f.result !== null)
}
