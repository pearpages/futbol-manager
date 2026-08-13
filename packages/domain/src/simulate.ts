import type { Club, ClubId, Competition } from './entities.ts'
import { generateFixtures } from './fixtures.ts'
import { BALANCED, bestXI, type Formation, type Lineup, type Tactics } from './lineup.ts'
import type { Player } from './player.ts'
import { reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { generateLeagueSquads } from './squad.ts'
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

export const DEFAULT_FORMATION: Formation = '4-4-2'

export interface NewSeasonOptions {
  /** Name pool for generated players. `@fm/data` supplies `PLAYER_NAMES`. */
  readonly names: readonly string[]
  /** Seeds squad generation. Required — a league without squads cannot resolve a match. */
  readonly rng: Rng
  /** Which club the human takes. Defaults to the last-rated, which is the hard game. */
  readonly managedClubId?: ClubId
}

export function newSeason(
  clubs: readonly Club[],
  startYear: number,
  options: NewSeasonOptions,
): GameState {
  const ids = clubs.map((c) => c.id)
  const competition: Competition = {
    id: 'primera',
    name: 'Primera División',
    clubIds: ids,
  }
  const start = defaultSeasonStart(startYear)

  const squadsByClub = generateLeagueSquads(clubs, options.rng, {
    names: options.names,
    seasonStart: start,
  })

  const squads: Record<string, readonly Player[]> = {}
  const lineups: Record<string, Lineup> = {}
  const tactics: Record<string, Tactics> = {}

  for (const club of clubs) {
    const squad = squadsByClub.get(club.id) ?? []
    squads[club.id] = squad
    // Every club starts on its strongest XI. The human manager overrides theirs
    // from M3b; AI clubs simply keep this.
    lineups[club.id] = bestXI(squad, DEFAULT_FORMATION)
    tactics[club.id] = BALANCED
  }

  return {
    clubs,
    competition,
    season: {
      startYear,
      currentDate: start,
      fixtures: generateFixtures(ids, start),
    },
    squads,
    lineups,
    tactics,
    managedClubId: options.managedClubId ?? clubs.at(-1)?.id ?? (ids[0] as ClubId),
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
  options: {
    names: readonly string[]
    firstYear?: number
    adjust?: (state: GameState) => GameState
  },
): SeasonRun[] {
  const master = createRng(seed)
  const runs: SeasonRun[] = []
  const firstYear = options.firstYear ?? 2026

  for (let i = 0; i < count; i++) {
    const startYear = firstYear + i
    const seasonRng = createRng(Math.floor(master.next() * 0x1_0000_0000))
    const fresh = newSeason(clubs, startYear, { names: options.names, rng: seasonRng })
    // `adjust` exists so a test can sabotage one club's lineup before kickoff —
    // that is how "picking a bad XI costs you points" gets measured.
    const start = options.adjust === undefined ? fresh : options.adjust(fresh)
    runs.push({ startYear, state: simulateSeason(start, seasonRng) })
  }

  return runs
}
