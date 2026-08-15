import { describe, expect, it } from 'vitest'
import type { ClubId } from './entities.ts'
import {
  CLUB_COUNT,
  FIXTURES_PER_ROUND,
  TOTAL_ROUNDS,
  fixturesOn,
  generateFixtures,
  recentResultsFor,
} from './fixtures.ts'
import { fromCivil } from './time.ts'

const clubIds = Array.from({ length: CLUB_COUNT }, (_, i) => `c${i + 1}` as ClubId)
const seasonStart = fromCivil(2026, 8, 15)
const fixtures = generateFixtures(clubIds, seasonStart)

describe('generateFixtures', () => {
  it('produces a full double round-robin', () => {
    expect(fixtures).toHaveLength(380)
    expect(new Set(fixtures.map((f) => f.round)).size).toBe(TOTAL_ROUNDS)
  })

  it('gives every round exactly ten fixtures and every club exactly one', () => {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const inRound = fixtures.filter((f) => f.round === round)
      expect(inRound).toHaveLength(FIXTURES_PER_ROUND)

      const appearing = inRound.flatMap((f) => [f.homeId, f.awayId])
      expect(new Set(appearing).size).toBe(CLUB_COUNT)
    }
  })

  it('has every club play 38 games, 19 home and 19 away', () => {
    for (const id of clubIds) {
      const home = fixtures.filter((f) => f.homeId === id)
      const away = fixtures.filter((f) => f.awayId === id)
      expect(home).toHaveLength(19)
      expect(away).toHaveLength(19)
    }
  })

  it('pairs every ordered club pair exactly once', () => {
    const pairs = fixtures.map((f) => `${f.homeId}v${f.awayId}`)
    expect(new Set(pairs).size).toBe(380)

    // And the reverse leg of each exists.
    for (const f of fixtures) {
      expect(pairs).toContain(`${f.awayId}v${f.homeId}`)
    }
  })

  it('never pairs a club with itself', () => {
    expect(fixtures.some((f) => f.homeId === f.awayId)).toBe(false)
  })

  it('avoids long home or away streaks', () => {
    // Not a cosmetic check: a club with 6 straight away games would distort the
    // table in a way that looks like a resolver bug at M2.
    for (const id of clubIds) {
      const venues = fixtures
        .filter((f) => f.homeId === id || f.awayId === id)
        .sort((a, b) => a.round - b.round)
        .map((f) => (f.homeId === id ? 'H' : 'A'))

      let longest = 1
      let current = 1
      for (let i = 1; i < venues.length; i++) {
        current = venues[i] === venues[i - 1] ? current + 1 : 1
        longest = Math.max(longest, current)
      }
      expect(longest).toBeLessThanOrEqual(3)
    }
  })

  it('gives every fixture a unique id and starts unplayed', () => {
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(380)
    expect(fixtures.every((f) => f.result === null)).toBe(true)
  })

  it('schedules one round per week from the season start', () => {
    expect(fixturesOn(fixtures, seasonStart)).toHaveLength(FIXTURES_PER_ROUND)
    for (const f of fixtures) {
      expect(f.date).toBe(seasonStart + (f.round - 1) * 7)
    }
  })

  it('is deterministic — no rng involved at all', () => {
    expect(generateFixtures(clubIds, seasonStart)).toEqual(fixtures)
  })

  it('rejects a league that is not 20 clubs', () => {
    expect(() => generateFixtures(clubIds.slice(0, 18), seasonStart)).toThrow(/Expected 20 clubs/)
  })
})

describe('recentResultsFor', () => {
  const US = 'c1' as ClubId

  /** Our fixtures, in the order they are played. */
  const ourFixtures = fixtures
    .filter((f) => f.homeId === US || f.awayId === US)
    .sort((a, b) => a.date - b.date)

  /**
   * Plays our first fixtures to the given scores, written **from our point of
   * view** — the helper flips them onto the fixture for away games, so a test can
   * say "we won 2–0" without caring where it was played.
   */
  const played = (scores: readonly (readonly [number, number])[]) => {
    const byId = new Map(
      scores.map((score, i) => [ourFixtures[i]?.id, score] as const).filter(([id]) => id),
    )

    return fixtures.map((fixture) => {
      const score = byId.get(fixture.id)
      if (score === undefined) return fixture
      const [ours, theirs] = score
      const home = fixture.homeId === US
      return {
        ...fixture,
        result: home ? { home: ours, away: theirs } : { home: theirs, away: ours },
      }
    })
  }

  it('returns nothing before a ball is kicked', () => {
    expect(recentResultsFor(fixtures, US, 5)).toEqual([])
  })

  it('returns fewer than asked for early on, oldest first', () => {
    const results = recentResultsFor(
      played([
        [1, 0],
        [2, 2],
      ]),
      US,
      5,
    )

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.outcome)).toEqual(['win', 'draw'])
    expect(results.map((r) => r.fixtureId)).toEqual([ourFixtures[0]?.id, ourFixtures[1]?.id])
  })

  it('keeps the last n and drops the oldest, still oldest-first', () => {
    const results = recentResultsFor(
      played([
        [9, 0],
        [1, 0],
        [2, 2],
        [0, 0],
        [3, 1],
        [0, 4],
      ]),
      US,
      5,
    )

    expect(results).toHaveLength(5)
    expect(results.map((r) => r.outcome)).toEqual(['win', 'draw', 'draw', 'win', 'loss'])
    // The 9–0 is trimmed from the front, not the back — the newest survives.
    expect(results.some((r) => r.ours === 9)).toBe(false)
    expect(results.map((r) => r.fixtureId)).toEqual(ourFixtures.slice(1, 6).map((f) => f.id))
  })

  /**
   * The one that matters. `ours` and `theirs` swap on venue, so reading them straight
   * off the score inverts every away result — and a strip of colours that is wrong
   * only for away games still looks entirely plausible.
   */
  it('reads an away result from the away club’s point of view', () => {
    const away = ourFixtures.find((f) => f.awayId === US)
    if (away === undefined) throw new Error('no away fixture')

    const withResult = fixtures.map((f) =>
      f.id === away.id ? { ...f, result: { home: 0, away: 2 } } : f,
    )

    const ours = recentResultsFor(withResult, US, 5)[0]
    expect(ours?.outcome).toBe('win')
    expect(ours?.ours).toBe(2)
    expect(ours?.theirs).toBe(0)
    expect(ours?.home).toBe(false)
    expect(ours?.opponentId).toBe(away.homeId)

    // The same fixture is a loss for the club that conceded it at home.
    const theirs = recentResultsFor(withResult, away.homeId, 5)[0]
    expect(theirs?.outcome).toBe('loss')
    expect(theirs?.home).toBe(true)
    expect(theirs?.opponentId).toBe(US)
  })

  it('ignores unplayed fixtures and other clubs’ results', () => {
    const state = played([
      [1, 0],
      [0, 3],
    ])

    const results = recentResultsFor(state, US, 5)
    expect(results).toHaveLength(2)
    for (const result of results) expect(result.opponentId).not.toBe(US)

    // Only our two fixtures were played, so a club we have not met yet has nothing
    // to report even though the league around it does.
    const met = new Set(results.map((r) => r.opponentId))
    const idle = clubIds.find((id) => id !== US && !met.has(id))
    if (idle === undefined) throw new Error('no untouched club')
    expect(recentResultsFor(state, idle, 5)).toEqual([])
  })
})
