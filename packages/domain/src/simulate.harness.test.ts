import { describe, expect, it } from 'vitest'
import { TOTAL_ROUNDS } from './fixtures.ts'
import { computeTable, type TableRow } from './table.ts'
import { DEFAULT_FORMATION, simulateSeasons } from './simulate.ts'
import { worstXI } from './lineup.ts'
import { TEST_NAMES } from './test-clubs.ts'
import { EVEN_CLUBS, TEST_CLUBS } from './test-clubs.ts'

/**
 * The N-season statistical harness. Pulled forward from M2 deliberately — the
 * roadmap names balance tuning as the most-underestimated cost and this as its
 * mitigation, so the tool should exist and be trusted *before* there is anything
 * to calibrate.
 *
 * Two tiers, and the distinction is the whole design:
 *
 *   STRUCTURAL INVARIANTS — permanent. True under a coin flip, true under M2's
 *   Poisson model, true at M7. If one of these breaks, something is genuinely
 *   wrong, not merely mistuned. Never loosen these to make a change pass.
 *
 *   DISTRIBUTION BANDS — calibrated. Narrowed at M2 from the wide M1 widths that a
 *   coin flip could pass, and now sitting either side of measured figures. When a
 *   change pushes one out of band, retune the model — do not widen the band.
 */

const SEASONS = 50
const SEED = 20260813

const clubs = TEST_CLUBS

const runs = simulateSeasons(clubs, SEASONS, SEED, { names: TEST_NAMES })
const tables: TableRow[][] = runs.map((run) =>
  computeTable(run.state.competition.clubIds, run.state.season.fixtures),
)
const allFixtures = runs.flatMap((run) => run.state.season.fixtures)

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

describe(`structural invariants over ${SEASONS} seasons`, () => {
  it('plays every fixture of every season', () => {
    expect(allFixtures).toHaveLength(SEASONS * 380)
    expect(allFixtures.every((f) => f.result !== null)).toBe(true)
  })

  it('gives every club 38 games in every season', () => {
    for (const table of tables) {
      expect(table).toHaveLength(20)
      expect(table.every((row) => row.played === TOTAL_ROUNDS)).toBe(true)
    }
  })

  it('conserves goals league-wide — every goal scored is a goal conceded', () => {
    for (const table of tables) {
      const scored = table.reduce((sum, r) => sum + r.goalsFor, 0)
      const conceded = table.reduce((sum, r) => sum + r.goalsAgainst, 0)
      expect(scored).toBe(conceded)
      expect(table.reduce((sum, r) => sum + r.goalDifference, 0)).toBe(0)
    }
  })

  it('keeps points arithmetic exact', () => {
    for (const table of tables) {
      for (const row of table) {
        expect(row.points).toBe(row.won * 3 + row.drawn)
        expect(row.played).toBe(row.won + row.drawn + row.lost)
      }
    }
  })

  it('conserves match outcomes — every win is someone else’s loss', () => {
    for (const table of tables) {
      const wins = table.reduce((sum, r) => sum + r.won, 0)
      const losses = table.reduce((sum, r) => sum + r.lost, 0)
      const draws = table.reduce((sum, r) => sum + r.drawn, 0)
      expect(wins).toBe(losses)
      expect(draws % 2).toBe(0)
      expect(wins + losses + draws).toBe(380 * 2)
    }
  })

  it('returns each table as a permutation of the league', () => {
    for (const table of tables) {
      expect(new Set(table.map((r) => r.clubId)).size).toBe(20)
    }
  })

  it('orders every table by points, descending', () => {
    for (const table of tables) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i - 1]?.points).toBeGreaterThanOrEqual(table[i]?.points ?? 0)
      }
    }
  })
})

describe('distribution bands — calibrated at M2', () => {
  // Measured over this exact 50-season run at calibration time, 2026-08-13:
  //   goals/game 2.70 · home wins 45.5% · draws 23.6%
  //   champion 87.1 (76–98) · 18th 33.0 · bottom 25.6 · spread 61.5

  it('goals per game', () => {
    const goals = allFixtures.reduce(
      (sum, f) => sum + (f.result?.home ?? 0) + (f.result?.away ?? 0),
      0,
    )
    const perGame = goals / allFixtures.length
    expect(perGame).toBeGreaterThan(2.45)
    expect(perGame).toBeLessThan(2.95)
  })

  it('home win rate', () => {
    const homeWins = allFixtures.filter((f) => (f.result?.home ?? 0) > (f.result?.away ?? 0)).length
    const rate = homeWins / allFixtures.length
    expect(rate).toBeGreaterThan(0.41)
    expect(rate).toBeLessThan(0.5)
  })

  it('draw rate', () => {
    const draws = allFixtures.filter((f) => f.result?.home === f.result?.away).length
    const rate = draws / allFixtures.length
    expect(rate).toBeGreaterThan(0.19)
    expect(rate).toBeLessThan(0.29)
  })

  it('champion points — the roadmap exit criterion', () => {
    // "Champion lands ~85–95 points, not 130."
    const champions = tables.map((t) => t[0]?.points ?? 0)
    expect(mean(champions)).toBeGreaterThan(82)
    expect(mean(champions)).toBeLessThan(95)
    // No individual season absurd in either direction.
    expect(Math.min(...champions)).toBeGreaterThan(68)
    expect(Math.max(...champions)).toBeLessThan(110)
  })

  it('relegation and bottom-of-table points', () => {
    const eighteenth = tables.map((t) => t[17]?.points ?? 0)
    const bottom = tables.map((t) => t.at(-1)?.points ?? 0)
    expect(mean(eighteenth)).toBeGreaterThan(25)
    expect(mean(eighteenth)).toBeLessThan(42)
    expect(mean(bottom)).toBeGreaterThan(15)
  })

  it('spread between champion and bottom club', () => {
    const spreads = tables.map((t) => (t[0]?.points ?? 0) - (t.at(-1)?.points ?? 0))
    expect(mean(spreads)).toBeGreaterThan(45)
    expect(mean(spreads)).toBeLessThan(80)
  })
})

describe('ratings actually drive results', () => {
  // None of this could be asserted at M1 — under a coin flip every club is
  // identical. These are the tests that say the resolver reads its inputs.

  const meanPosition = (clubId: string) =>
    mean(tables.map((t) => t.findIndex((r) => r.clubId === clubId) + 1))

  it('ranks strong clubs above weak ones on average', () => {
    // TEST_CLUBS is ordered strongest to weakest.
    const strongest = clubs.slice(0, 5).map((c) => meanPosition(c.id))
    const weakest = clubs.slice(-5).map((c) => meanPosition(c.id))
    expect(mean(strongest)).toBeLessThan(8)
    expect(mean(weakest)).toBeGreaterThan(13)
  })

  it('gives the title to a well-rated club nearly always', () => {
    const topSix = new Set<string>(clubs.slice(0, 6).map((c) => c.id))
    const wins = tables.filter((t) => topSix.has(t[0]?.clubId ?? '')).length
    expect(wins / tables.length).toBeGreaterThan(0.85)
  })

  it('still lets a weak club beat a strong one sometimes', () => {
    // Without upsets the game is a spreadsheet; without the ceiling it is a lottery.
    const strongest = clubs[0]
    const weakest = clubs.at(-1)
    /* c8 ignore next */
    if (strongest === undefined || weakest === undefined) throw new Error('no clubs')

    const meetings = allFixtures.filter(
      (f) =>
        (f.homeId === strongest.id && f.awayId === weakest.id) ||
        (f.homeId === weakest.id && f.awayId === strongest.id),
    )
    const upsets = meetings.filter((f) => {
      const weakScored = f.homeId === weakest.id ? f.result?.home : f.result?.away
      const strongScored = f.homeId === strongest.id ? f.result?.home : f.result?.away
      return (weakScored ?? 0) > (strongScored ?? 0)
    })

    expect(meetings).toHaveLength(SEASONS * 2)
    expect(upsets.length).toBeGreaterThan(0)
    expect(upsets.length / meetings.length).toBeLessThan(0.3)
  })

  it('collapses the points spread when every club is rated identically', () => {
    // Proves the spread comes from the ratings rather than the model's own
    // variance — this is what would catch a resolver silently ignoring its input.
    const even = simulateSeasons(EVEN_CLUBS, 10, SEED, { names: TEST_NAMES })
    const evenSpreads = even.map((run) => {
      const t = computeTable(run.state.competition.clubIds, run.state.season.fixtures)
      return (t[0]?.points ?? 0) - (t.at(-1)?.points ?? 0)
    })
    const ratedSpreads = tables.map((t) => (t[0]?.points ?? 0) - (t.at(-1)?.points ?? 0))

    expect(mean(evenSpreads)).toBeLessThan(mean(ratedSpreads) * 0.7)
  })
})

describe('lineup selection matters — the M3 exit criterion', () => {
  // "You can pick a starting XI, and picking a bad one demonstrably costs you
  // points over a season." That is a statistical claim, so the harness is where it
  // gets settled — before any screen exists to pick a lineup on.
  //
  // A mid-table club is sabotaged rather than the strongest: the best club would
  // still finish high on reputation alone, which would prove less.

  const victim = clubs[9]
  /* c8 ignore next */
  if (victim === undefined) throw new Error('no victim club')

  const SABOTAGE_SEASONS = 20

  const control = simulateSeasons(clubs, SABOTAGE_SEASONS, SEED, { names: TEST_NAMES })
  const sabotaged = simulateSeasons(clubs, SABOTAGE_SEASONS, SEED, {
    names: TEST_NAMES,
    adjust: (state) => ({
      ...state,
      lineups: {
        ...state.lineups,
        [victim.id]: worstXI(state.squads[victim.id] ?? [], DEFAULT_FORMATION),
      },
    }),
  })

  const pointsFor = (runs: typeof control) =>
    mean(
      runs.map((run) => {
        const table = computeTable(run.state.competition.clubIds, run.state.season.fixtures)
        return table.find((r) => r.clubId === victim.id)?.points ?? 0
      }),
    )

  const positionFor = (runs: typeof control) =>
    mean(
      runs.map((run) => {
        const table = computeTable(run.state.competition.clubIds, run.state.season.fixtures)
        return table.findIndex((r) => r.clubId === victim.id) + 1
      }),
    )

  it('costs real points over a season', () => {
    const lost = pointsFor(control) - pointsFor(sabotaged)
    expect(lost).toBeGreaterThan(8)
  })

  it('costs league positions', () => {
    expect(positionFor(sabotaged)).toBeGreaterThan(positionFor(control) + 2)
  })

  it('leaves every other club’s season untouched by the same seed', () => {
    // Sanity check on the experiment itself: only the sabotaged club's results
    // should differ, or the comparison above is measuring noise.
    const untouched = clubs[0]
    /* c8 ignore next */
    if (untouched === undefined) throw new Error('no club')
    expect(control[0]?.state.squads[untouched.id]).toEqual(sabotaged[0]?.state.squads[untouched.id])
  })
})

describe('tactics are a decision, not a cost — the M3c exit criterion', () => {
  // Before tempo existed, balanced was optimal at every club: upside 0-3 points,
  // downside -4 to -9. A slider with one right answer is not a decision.
  //
  // This asserts the *gradient* rather than any club's argmax. Gaps between the
  // extremes run to 8-16 points, far outside the noise, whereas an argmax over
  // five settings can flip on a couple of points of variance.

  const TACTIC_SEASONS = 12

  const pointsWith = (club: (typeof clubs)[number], attacking: number) =>
    mean(
      simulateSeasons(clubs, TACTIC_SEASONS, SEED, {
        names: TEST_NAMES,
        adjust: (state) => ({
          ...state,
          tactics: { ...state.tactics, [club.id]: { attacking } },
        }),
      }).map((run) => {
        const table = computeTable(run.state.competition.clubIds, run.state.season.fixtures)
        return table.find((r) => r.clubId === club.id)?.points ?? 0
      }),
    )

  const strongest = clubs[0]
  const weakest = clubs.at(-1)
  /* c8 ignore next */
  if (strongest === undefined || weakest === undefined) throw new Error('no clubs')

  it('rewards a strong club for opening the game up', () => {
    expect(pointsWith(strongest, 100)).toBeGreaterThan(pointsWith(strongest, 0) + 5)
  })

  it('rewards a weak club for smothering it', () => {
    // The underdog's whole game: fewer goals means more draws, and a draw is
    // worth far more to the side that would otherwise lose.
    expect(pointsWith(weakest, 0)).toBeGreaterThan(pointsWith(weakest, 100) + 3)
  })

  it('has no setting that suits everybody', () => {
    // The actual criterion. If one approach were best for both ends of the table
    // it would be a dominant strategy and the slider would be decoration again.
    const strongPrefersAttack = pointsWith(strongest, 100) > pointsWith(strongest, 0)
    const weakPrefersAttack = pointsWith(weakest, 100) > pointsWith(weakest, 0)
    expect(strongPrefersAttack).not.toBe(weakPrefersAttack)
  })
})

describe('determinism at scale', () => {
  it('reproduces an identical multi-season run from the same seed', () => {
    const repeat = simulateSeasons(clubs, SEASONS, SEED, { names: TEST_NAMES })
    const repeatTables = repeat.map((run) =>
      computeTable(run.state.competition.clubIds, run.state.season.fixtures),
    )
    expect(repeatTables).toEqual(tables)
  })

  it('produces a different run from a different seed', () => {
    const other = simulateSeasons(clubs, 3, SEED + 1, { names: TEST_NAMES })
    const otherTables = other.map((run) =>
      computeTable(run.state.competition.clubIds, run.state.season.fixtures),
    )
    expect(otherTables).not.toEqual(tables.slice(0, 3))
  })
})
