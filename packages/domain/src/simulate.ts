import type { Club, ClubId, Competition } from './entities.ts'
import { openingBoard } from './board.ts'
import { seasonSchedule } from './fixtures.ts'
import { BALANCED, bestXI, type Formation, type Lineup, type Tactics } from './lineup.ts'
import type { Player } from './player.ts'
import { reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { generateLeagueSquads, type RosterEntry } from './squad.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { type ForeignLeague, NO_FOREIGN } from './foreign.ts'
import { defaultSeasonStart, rolloverSeason } from './season.ts'
import { applyTransfers, runTransferWindow } from './market.ts'

/**
 * Season drivers shared by the headless script, the harness and (from M3) the UI.
 *
 * Everything here goes through `reduce`. That is deliberate: the statistical
 * harness is the regression net for every balance change in M2, M4 and M5, and a
 * net that drives private helpers instead of the real command path would verify a
 * code path that never ships.
 */

export { defaultSeasonStart } from './season.ts'

export const DEFAULT_FORMATION: Formation = '4-4-2'

export interface NewSeasonOptions {
  /** Name pool for generated players. `@fm/data` supplies `PLAYER_NAMES`. */
  readonly names: readonly string[]
  /** Seeds squad generation. Required — a league without squads cannot resolve a match. */
  readonly rng: Rng
  /** Which club the human takes. Defaults to the last-rated, which is the hard game. */
  readonly managedClubId?: ClubId
  /**
   * Real squad shapes, keyed by club id. `@fm/data` supplies `DEFAULT_ROSTERS`;
   * anything without an entry falls back to a generated squad.
   */
  readonly rosters?: Readonly<Record<string, readonly RosterEntry[]>>
  /**
   * Clubs abroad. `@fm/data` supplies the list; absent, a career simply has no
   * foreign market, which is exactly how every harness in this package runs.
   */
  readonly foreign?: ForeignLeague
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
    ...(options.rosters === undefined ? {} : { rosters: options.rosters }),
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

  const managedClubId = options.managedClubId ?? clubs.at(-1)?.id ?? (ids[0] as ClubId)

  return {
    clubs,
    competition,
    season: {
      startYear,
      currentDate: start,
      fixtures: seasonSchedule(ids, startYear, start),
    },
    squads,
    lineups,
    tactics,
    managedClubId,
    // A new league has nobody out of contract and no business done yet. Both fill
    // from the first rollover onward.
    freeAgents: [],
    bids: [],
    shortlist: [],
    transferList: [],
    // The board's first target is the club's own standing, softened — there is
    // no last season to blend with yet.
    board: openingBoard(managedClubId, clubs),
    // A career starts with no past. The palmarés fills from this season forward,
    // one entry per rollover.
    history: [],
    // **Empty here, and filled by the app.** `domain` may not import `@fm/data`,
    // so the club list and the name pools have to arrive from outside — the same
    // arrangement `rosters` already has. It is also what keeps every harness in
    // this package measuring a league with no foreign market in it.
    foreign: options.foreign ?? NO_FOREIGN,
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

/**
 * A continuous career: the same clubs and squads, year after year, with transfer
 * windows in between.
 *
 * Deliberately separate from `simulateSeasons`. Independent seasons remain the
 * right instrument for distribution bands — each is a clean sample from the same
 * starting conditions — while squad drift can only be seen in a career. One
 * function serving both would serve neither well.
 */
export function simulateCareer(
  clubs: readonly Club[],
  seasons: number,
  seed: number,
  options: { names: readonly string[]; firstYear?: number },
): SeasonRun[] {
  const rng = createRng(seed)
  const runs: SeasonRun[] = []
  let state = newSeason(clubs, options.firstYear ?? 2026, { names: options.names, rng })

  for (let i = 0; i < seasons; i++) {
    // Business is done before a ball is kicked, which is when a real pre-season
    // window closes.
    state = applyTransfers(state, runTransferWindow(state, rng))
    state = simulateSeason(state, rng)
    runs.push({ startYear: state.season.startYear, state })
    if (i < seasons - 1) state = rolloverSeason(state, rng, { names: options.names })
  }

  return runs
}

export interface SeasonRun {
  readonly startYear: number
  readonly state: GameState
}

/**
 * Runs `count` seasons from one master seed. Each season draws its own seed from
 * the master rng, so the whole run is reproducible from a single number.
 *
 * **`rosters` is the passthrough that lets a harness measure the league the game
 * actually ships.** Without it every band here runs on generated squads, which
 * scale every position uniformly from one club rating and so cannot be lopsided —
 * `docs/roadmap.md` carried that as a known open item, and it cost a real finding
 * twice. `domain` cannot import `@fm/data`, so a caller that wants the real thing
 * has to live in `@fm/data` or above and hand it in; `packages/data/src/
 * formations.harness.test.ts` is the first one that does.
 */
export function simulateSeasons(
  clubs: readonly Club[],
  count: number,
  seed: number,
  options: {
    names: readonly string[]
    firstYear?: number
    adjust?: (state: GameState) => GameState
    rosters?: Readonly<Record<string, readonly RosterEntry[]>>
  },
): SeasonRun[] {
  const master = createRng(seed)
  const runs: SeasonRun[] = []
  const firstYear = options.firstYear ?? 2026

  for (let i = 0; i < count; i++) {
    const startYear = firstYear + i
    const seasonRng = createRng(Math.floor(master.next() * 0x1_0000_0000))
    const fresh = newSeason(clubs, startYear, {
      names: options.names,
      rng: seasonRng,
      ...(options.rosters === undefined ? {} : { rosters: options.rosters }),
    })
    // `adjust` exists so a test can sabotage one club's lineup before kickoff —
    // that is how "picking a bad XI costs you points" gets measured.
    const start = options.adjust === undefined ? fresh : options.adjust(fresh)
    runs.push({ startYear, state: simulateSeason(start, seasonRng) })
  }

  return runs
}
