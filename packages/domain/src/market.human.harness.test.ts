import { describe, expect, it } from 'vitest'
import { ANSWER_DAYS, suggestedTerms } from './bids.ts'
import type { ClubId } from './entities.ts'
import { bestXI } from './lineup.ts'
import { MAX_SQUAD, MIN_SQUAD, needFor, surplus, totalBudget } from './market.ts'
import { ageOn, type Player } from './player.ts'
import { reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { computeTable } from './table.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { askingPrice } from './valuation.ts'

/**
 * **M4b's exit criterion:** you can identify a weakness in your squad, buy a
 * player to fix it, and see it change your results.
 *
 * That is a statistical claim, so it is settled here over many seasons rather
 * than in a screen test. A single season cannot tell a three-point signing from
 * three points of variance — a trap this project has already fallen into once,
 * when an app test compared two single seasons and passed on luck for two
 * milestones.
 *
 * The measurement is a paired one: **the same seed, the same league, twice**, one
 * career shopping and one standing still. Because bid handling draws no
 * randomness and both arms burn the same number of days in the window, the two
 * rng streams stay identical right up to the moment a squad actually changes.
 * Everything after that is the signing and nothing else.
 */

const SEASONS = 10
const RUNS = 6
/** Mid-table. A contender has no weakness to fix and the bottom club cannot pay. */
const MANAGED = TEST_CLUBS[13]?.id ?? ('c14' as ClubId)
/** Windows a manager works in a summer. Both arms spend the same days on it. */
const ROUNDS = 4

interface Option {
  readonly player: Player
  readonly from: ClubId | null
  readonly fee: number
  readonly need: number
}

/** The biggest improvement to the XI this club can currently pay for. */
function bestSigning(state: GameState): Option | null {
  const me = state.managedClubId
  const squad = state.squads[me] ?? []
  if (squad.length >= MAX_SQUAD) return null

  const budget = state.clubs.find((c) => c.id === me)?.budget ?? 0
  const date = state.season.currentDate
  const options: Option[] = []

  for (const club of state.clubs) {
    if (club.id === me) continue
    for (const player of surplus(state.squads[club.id] ?? [])) {
      const fee = askingPrice(player, date)
      if (fee > budget) continue
      options.push({ player, from: club.id, fee, need: needFor(squad, player) })
    }
  }
  // Free agents cost nothing, which is the whole point of the pool.
  for (const player of state.freeAgents) {
    options.push({ player, from: null, fee: 0, need: needFor(squad, player) })
  }

  return options.filter((o) => o.need > 0.4).sort((a, b) => b.need - a.need)[0] ?? null
}

/**
 * A summer's work. `shop: false` does everything except the business, so both
 * arms consume identical rng.
 */
function transferWindow(state: GameState, rng: Rng, shop: boolean): GameState {
  for (let round = 0; round < ROUNDS; round++) {
    const target = shop ? bestSigning(state) : null

    if (target !== null && target.from !== null) {
      state = reduce(
        state,
        { type: 'MakeBid', playerId: target.player.id, fee: target.fee },
        rng,
      ).state
    }

    for (let day = 0; day <= ANSWER_DAYS; day++) {
      state = reduce(state, { type: 'AdvanceDay' }, rng).state
    }

    if (target === null) continue

    const terms = suggestedTerms(target.player, state.season.currentDate)
    try {
      state = reduce(
        state,
        {
          type: 'OfferContract',
          playerId: target.player.id,
          wage: terms.wage,
          years: terms.years,
        },
        rng,
      ).state
    } catch {
      // The fee was countered or he was sold elsewhere while we waited. A manager
      // shrugs and looks at the next name; it is not a failure of the run.
      continue
    }

    // Signing a player does not pick him. The reducer deliberately stopped
    // rebuilding the manager's XI behind his back, so a manager who buys someone
    // is a manager who then selects him.
    const squad = state.squads[state.managedClubId] ?? []
    const formation = state.lineups[state.managedClubId]?.formation ?? '4-4-2'
    state = reduce(
      state,
      { type: 'SetLineup', clubId: state.managedClubId, lineup: bestXI(squad, formation) },
      rng,
    ).state
  }

  return state
}

interface CareerResult {
  readonly points: number[]
  readonly positions: number[]
  readonly states: GameState[]
}

function career(seed: number, shop: boolean): CareerResult {
  const rng = createRng(seed)
  let state = newSeason(TEST_CLUBS, 2026, {
    names: TEST_NAMES,
    rng,
    managedClubId: MANAGED,
  })

  const points: number[] = []
  const positions: number[] = []
  const states: GameState[] = []

  for (let season = 0; season < SEASONS; season++) {
    state = transferWindow(state, rng, shop)
    state = simulateSeason(state, rng)

    const table = computeTable(state.competition.clubIds, state.season.fixtures)
    const index = table.findIndex((row) => row.clubId === MANAGED)
    /* c8 ignore next */
    if (index < 0) throw new Error('managed club missing from the table')
    points.push(table[index]?.points ?? 0)
    positions.push(index + 1)
    states.push(state)

    if (season < SEASONS - 1) {
      state = reduce(state, { type: 'StartNewSeason', names: TEST_NAMES }, rng).state
    }
  }

  return { points, positions, states }
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

const shopping: CareerResult[] = []
const standingStill: CareerResult[] = []
for (let run = 0; run < RUNS; run++) {
  const seed = 1000 + run * 7919
  shopping.push(career(seed, true))
  standingStill.push(career(seed, false))
}

const shopPoints = mean(shopping.flatMap((r) => r.points))
const idlePoints = mean(standingStill.flatMap((r) => r.points))
const shopPosition = mean(shopping.flatMap((r) => r.positions))
const idlePosition = mean(standingStill.flatMap((r) => r.positions))

describe(`the exit criterion, over ${RUNS * SEASONS} seasons`, () => {
  it('pays off: a manager who buys finishes higher than one who does not', () => {
    // Measured at roughly +3 points and half a place a season. The band is wide
    // on purpose — this is the *claim*, not a calibration. If it collapses toward
    // zero the market has stopped mattering, which is the regression worth
    // catching; if it runs away past ten the human has found a free win.
    const gained = shopPoints - idlePoints
    expect(gained).toBeGreaterThan(1.5)
    expect(gained).toBeLessThan(10)
    expect(shopPosition).toBeLessThan(idlePosition)
  })

  it('needed the budget rescale to be true at all', () => {
    // At M4b's start a mid-table club held 946k against a ~3,300k asking price for
    // a player of its own standard, and the whole league contained no affordable
    // signing that improved anybody. This asserts the scale, not the market: a
    // budget must reach a player of the club's own first-team quality.
    const state = shopping[0]?.states[0]
    /* c8 ignore next */
    if (state === undefined) throw new Error('no career')
    const squad = state.squads[MANAGED] ?? []
    const typical = mean(squad.map((p) => askingPrice(p, state.season.currentDate)))
    const budget = TEST_CLUBS[13]?.budget ?? 0
    expect(budget).toBeGreaterThan(typical)
  })
})

describe('a human career stays structurally sound', () => {
  const runs = shopping.flatMap((r) => r.states)

  it('conserves money exactly, even with a human in the market', () => {
    // The invariant M4a set and this milestone must not loosen. Wages are recorded
    // and never paid, and there is no signing bonus, so nothing leaves the league.
    for (const result of shopping) {
      const start = totalBudget(result.states[0] ?? runs[0]!)
      for (const state of result.states) expect(totalBudget(state)).toBeCloseTo(start, 6)
    }
  })

  it('keeps every squad inside its bounds', () => {
    for (const state of runs) {
      for (const club of TEST_CLUBS) {
        const squad = state.squads[club.id] ?? []
        expect(squad.length).toBeGreaterThanOrEqual(MIN_SQUAD)
        expect(squad.length).toBeLessThanOrEqual(MAX_SQUAD)
      }
    }
  })

  it('never loses or duplicates a player between squads and the pool', () => {
    for (const state of runs) {
      const all = [...TEST_CLUBS.flatMap((c) => state.squads[c.id] ?? []), ...state.freeAgents]
      expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    }
  })

  it('keeps a free-agent pool worth looking at', () => {
    // The route into the market for a club that cannot pay a fee. It drained to
    // nothing by season six when unsigned players were deleted each summer, which
    // is exactly the regression this guards.
    const later = shopping.flatMap((r) => r.states.slice(4))
    expect(mean(later.map((s) => s.freeAgents.length))).toBeGreaterThan(10)
  })

  it('does not turn the league into a nursery or a retirement home', () => {
    for (const state of runs) {
      for (const club of TEST_CLUBS) {
        const squad = state.squads[club.id] ?? []
        const age = mean(squad.map((p) => ageOn(p, state.season.currentDate)))
        expect(age).toBeGreaterThan(20)
        expect(age).toBeLessThan(33)
      }
    }
  })

  it('is deterministic — the same seed replays the same career', () => {
    const repeat = career(1000, true)
    expect(repeat.points).toEqual(shopping[0]?.points)
  })
})
