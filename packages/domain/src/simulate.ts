import type { Club, Competition } from './entities.ts'
import { generateFixtures } from './fixtures.ts'
import { reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { type DayNumber, fromCivil } from './time.ts'

/**
 * Season drivers shared by the headless script, the harness and (from M3) the UI.
 *
 * Everything here goes through `reduce`. That is deliberate: the statistical
 * harness is the regression net for every balance change in M2, M4 and M5, and a
 * net that drives private helpers instead of the real command path would verify a
 * code path that never ships.
 */

/** Mid-August, the traditional opening weekend. */
export function defaultSeasonStart(startYear: number): DayNumber {
  return fromCivil(startYear, 8, 15)
}

export function newSeason(clubs: readonly Club[], startYear: number): GameState {
  const ids = clubs.map((c) => c.id)
  const competition: Competition = {
    id: 'primera',
    name: 'Primera División',
    clubIds: ids,
  }
  const start = defaultSeasonStart(startYear)

  return {
    clubs,
    competition,
    season: {
      startYear,
      currentDate: start,
      fixtures: generateFixtures(ids, start),
    },
  }
}

/** Advances day by day until every fixture has been played. */
export function simulateSeason(state: GameState, rng: Rng): GameState {
  let current = state
  // Generous ceiling: 38 rounds a week apart is ~266 days. This guards against a
  // scheduling bug turning a test run into an infinite loop.
  const maxDays = 1000

  for (let day = 0; day < maxDays; day++) {
    if (isSeasonComplete(current)) return current
    current = reduce(current, { type: 'AdvanceDay' }, rng).state
  }

  throw new Error('Season did not complete within 1000 days — check fixture scheduling')
}

export interface SeasonRun {
  readonly startYear: number
  readonly state: GameState
}

/**
 * Runs `count` seasons from one master seed. Each season draws its own seed from
 * the master rng, so the whole run is reproducible from a single number.
 */
export function simulateSeasons(
  clubs: readonly Club[],
  count: number,
  seed: number,
  firstYear = 2026,
): SeasonRun[] {
  const master = createRng(seed)
  const runs: SeasonRun[] = []

  for (let i = 0; i < count; i++) {
    const startYear = firstYear + i
    const seasonRng = createRng(Math.floor(master.next() * 0x1_0000_0000))
    runs.push({ startYear, state: simulateSeason(newSeason(clubs, startYear), seasonRng) })
  }

  return runs
}
