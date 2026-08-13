import { describe, expect, it } from 'vitest'
import type { Club, ClubId } from './entities.ts'
import { TOTAL_ROUNDS } from './fixtures.ts'
import { computeTable, type TableRow } from './table.ts'
import { simulateSeasons } from './simulate.ts'

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
 *   DISTRIBUTION BANDS — provisional. Deliberately wide enough that M1's coin-flip
 *   resolver passes. Each records the real target alongside. M2's job is to narrow
 *   numbers that already exist rather than to build this file while also tuning
 *   against it.
 */

const SEASONS = 50
const SEED = 20260813

const clubs: Club[] = Array.from({ length: 20 }, (_, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}` as ClubId,
  name: `Club ${i + 1}`,
  shortName: `C${String(i + 1).padStart(2, '0')}`,
}))

const runs = simulateSeasons(clubs, SEASONS, SEED)
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

describe('distribution bands — LOOSE AT M1, TIGHTEN AT M2', () => {
  it('goals per game', () => {
    // Target (real football): ~2.6–2.8. M1 coin flip: uniform 0–3 a side → ~3.0.
    const goals = allFixtures.reduce(
      (sum, f) => sum + (f.result?.home ?? 0) + (f.result?.away ?? 0),
      0,
    )
    const perGame = goals / allFixtures.length
    expect(perGame).toBeGreaterThan(1.5)
    expect(perGame).toBeLessThan(5.5)
  })

  it('home win rate', () => {
    // Target: ~45%. M1 has no home advantage at all, so expect ~38% by symmetry.
    const homeWins = allFixtures.filter((f) => (f.result?.home ?? 0) > (f.result?.away ?? 0)).length
    const rate = homeWins / allFixtures.length
    expect(rate).toBeGreaterThan(0.2)
    expect(rate).toBeLessThan(0.65)
  })

  it('champion points', () => {
    // Target: 85–95. M1 has no skill differences, so the champion is whoever got
    // lucky — expect ~70. This band is the single clearest marker of M2's job.
    const champions = tables.map((t) => t[0]?.points ?? 0)
    expect(mean(champions)).toBeGreaterThan(55)
    expect(mean(champions)).toBeLessThan(105)
  })

  it('spread between champion and bottom club', () => {
    // Target: ~55–70 points. Under a coin flip, pure variance gives ~30.
    const spreads = tables.map((t) => (t[0]?.points ?? 0) - (t.at(-1)?.points ?? 0))
    expect(mean(spreads)).toBeGreaterThan(15)
    expect(mean(spreads)).toBeLessThan(85)
  })
})

describe('determinism at scale', () => {
  it('reproduces an identical multi-season run from the same seed', () => {
    const repeat = simulateSeasons(clubs, SEASONS, SEED)
    const repeatTables = repeat.map((run) =>
      computeTable(run.state.competition.clubIds, run.state.season.fixtures),
    )
    expect(repeatTables).toEqual(tables)
  })

  it('produces a different run from a different seed', () => {
    const other = simulateSeasons(clubs, 3, SEED + 1)
    const otherTables = other.map((run) =>
      computeTable(run.state.competition.clubIds, run.state.season.fixtures),
    )
    expect(otherTables).not.toEqual(tables.slice(0, 3))
  })
})
