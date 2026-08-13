import type { Club, ClubId, Competition, Fixture, Season } from './entities.ts'
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

/** True once every fixture in the season has a result. */
export function isSeasonComplete(state: GameState): boolean {
  return state.season.fixtures.every((f) => f.result !== null)
}
