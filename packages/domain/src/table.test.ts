import { describe, expect, it } from 'vitest'
import type { ClubId, Fixture, FixtureId } from './entities.ts'
import { computeTable } from './table.ts'
import { fromCivil } from './time.ts'

const DATE = fromCivil(2026, 8, 15)
let seq = 0

/** `'a 2-1 b'` → a played fixture. `'a -- b'` → scheduled but unplayed. */
function fx(spec: string): Fixture {
  const [home, score, away] = spec.split(' ')
  /* c8 ignore next */
  if (home === undefined || score === undefined || away === undefined) throw new Error(spec)

  const result =
    score === '--' ? null : { home: Number(score.split('-')[0]), away: Number(score.split('-')[1]) }

  return {
    id: `f${seq++}` as FixtureId,
    round: 1,
    date: DATE,
    homeId: home as ClubId,
    awayId: away as ClubId,
    result,
  }
}

const ids = (...names: string[]) => names as ClubId[]
const order = (rows: { clubId: ClubId }[]) => rows.map((r) => r.clubId).join(',')

describe('computeTable', () => {
  it('accumulates results into a table', () => {
    const table = computeTable(ids('a', 'b'), [fx('a 3-1 b')])
    expect(table[0]).toEqual({
      clubId: 'a',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 3,
      goalsAgainst: 1,
      goalDifference: 2,
      points: 3,
    })
    expect(table[1]?.points).toBe(0)
    expect(table[1]?.lost).toBe(1)
  })

  it('awards one point each for a draw', () => {
    const table = computeTable(ids('a', 'b'), [fx('a 1-1 b')])
    expect(table.map((r) => r.points)).toEqual([1, 1])
    expect(table.every((r) => r.drawn === 1)).toBe(true)
  })

  it('ignores unplayed fixtures', () => {
    const table = computeTable(ids('a', 'b'), [fx('a -- b')])
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true)
  })

  it('ranks on points before anything else', () => {
    // b has a far better goal difference but one point fewer.
    const table = computeTable(ids('a', 'b', 'c'), [
      fx('a 1-0 c'),
      fx('c 0-9 b'),
      fx('b 0-1 a'),
      fx('a 0-0 b'),
      fx('c 0-0 a'),
      fx('b 0-0 c'),
    ])
    expect(table[0]?.clubId).toBe('a')
  })
})

describe('tiebreakers', () => {
  it('puts the head-to-head winner above a better overall goal difference', () => {
    // The rung that distinguishes Spanish rules from goal-difference-first
    // leagues. a and b finish level on 6 points: a won both meetings with b, while
    // b built a far better goal difference thrashing c. a finishes above.
    // d and c sit clear of the tie so the tied block is exactly {a, b}.
    const fixtures = [
      fx('a 1-0 b'),
      fx('b 0-1 a'), // a takes all 6 points from b
      fx('a 0-1 d'),
      fx('d 1-0 a'), // ...and gives 6 back to d
      fx('b 5-0 c'),
      fx('c 0-5 b'), // b takes 6 from c with +10 goal difference
      fx('d 1-0 c'),
      fx('c 0-1 d'),
    ]
    const table = computeTable(ids('a', 'b', 'c', 'd'), fixtures)
    const a = table.find((r) => r.clubId === 'a')
    const b = table.find((r) => r.clubId === 'b')

    expect(a?.points).toBe(6)
    expect(b?.points).toBe(6)
    expect(b?.goalDifference).toBeGreaterThan(a?.goalDifference ?? 0)
    expect(order(table)).toBe('d,a,b,c')
  })

  it('falls through to overall goal difference when head-to-head is level', () => {
    const table = computeTable(ids('a', 'b', 'c'), [
      fx('a 0-0 b'),
      fx('b 0-0 a'), // head-to-head dead level
      fx('a 5-0 c'),
      fx('c 0-0 a'),
      fx('b 1-0 c'),
      fx('c 0-0 b'),
    ])
    expect(order(table).indexOf('a')).toBeLessThan(order(table).indexOf('b'))
  })

  it('skips head-to-head entirely when the meetings are incomplete', () => {
    // Mid-season: a beat b, but the reverse fixture has not been played, so the
    // mini-league is not yet meaningful. b's superior goal difference decides.
    const table = computeTable(ids('a', 'b', 'c'), [
      fx('a 1-0 b'),
      fx('b -- a'), // not yet played
      fx('a 0-1 c'),
      fx('b 5-0 c'),
    ])
    const a = table.find((r) => r.clubId === 'a')
    const b = table.find((r) => r.clubId === 'b')

    expect(a?.points).toBe(b?.points)
    expect(order(table).indexOf('b')).toBeLessThan(order(table).indexOf('a'))
  })

  it('resolves a three-way tie recursively', () => {
    // a, b, c all level on points. The three-way mini-table separates a; b and c
    // remain level and are then compared on their own head-to-head, not on the
    // three-way numbers.
    const table = computeTable(ids('a', 'b', 'c', 'd'), [
      // Mini-league among a, b, c
      fx('a 2-0 b'),
      fx('b 0-1 a'), // a takes 6 pts in the mini-league
      fx('b 1-0 c'),
      fx('c 0-1 b'), // b takes 6 from c, 0 from a
      fx('c 0-0 a'),
      fx('a 0-0 c'),
      // d loses everything, keeping a/b/c level on total points
      fx('d 0-1 a'),
      fx('a 0-0 d'),
      fx('d 0-1 b'),
      fx('b 0-0 d'),
      fx('d 0-1 c'),
      fx('c 0-0 d'),
    ])
    expect(table[3]?.clubId).toBe('d')
    expect(table.slice(0, 3).map((r) => r.clubId)).toEqual(['a', 'b', 'c'])
  })

  it('falls back to club id, never to the rng', () => {
    // Two clubs identical in every respect. The order must be stable across calls
    // — a table that reshuffles between renders of the same state is a bug.
    const fixtures = [fx('b 0-0 a'), fx('a 0-0 b')]
    const first = computeTable(ids('b', 'a'), fixtures)
    const second = computeTable(ids('a', 'b'), fixtures)

    expect(order(first)).toBe('a,b')
    expect(order(second)).toBe('a,b')
  })

  it('is stable across repeated calls with a full season', () => {
    const fixtures = [
      fx('a 1-1 b'),
      fx('b 1-1 a'),
      fx('a 2-2 c'),
      fx('c 2-2 a'),
      fx('b 0-0 c'),
      fx('c 0-0 b'),
    ]
    const runs = Array.from({ length: 5 }, () => order(computeTable(ids('a', 'b', 'c'), fixtures)))
    expect(new Set(runs).size).toBe(1)
  })
})

describe('table invariants', () => {
  it('conserves goals and points across the league', () => {
    const fixtures = [fx('a 2-1 b'), fx('b 0-3 c'), fx('c 1-1 a'), fx('a 0-2 c')]
    const table = computeTable(ids('a', 'b', 'c'), fixtures)

    const goalsFor = table.reduce((sum, r) => sum + r.goalsFor, 0)
    const goalsAgainst = table.reduce((sum, r) => sum + r.goalsAgainst, 0)
    expect(goalsFor).toBe(goalsAgainst)
    expect(table.reduce((sum, r) => sum + r.goalDifference, 0)).toBe(0)

    for (const row of table) {
      expect(row.played).toBe(row.won + row.drawn + row.lost)
      expect(row.points).toBe(row.won * 3 + row.drawn)
    }
  })

  it('returns exactly one row per club', () => {
    const table = computeTable(ids('a', 'b', 'c'), [fx('a 1-0 b')])
    expect(table).toHaveLength(3)
    expect(new Set(table.map((r) => r.clubId)).size).toBe(3)
  })

  it('ignores fixtures involving clubs outside the table', () => {
    const table = computeTable(ids('a', 'b'), [fx('a 1-0 z'), fx('a 1-0 b')])
    expect(table.find((r) => r.clubId === 'a')?.played).toBe(1)
  })
})
