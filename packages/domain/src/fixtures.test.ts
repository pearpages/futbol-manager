import { describe, expect, it } from 'vitest'
import type { ClubId } from './entities.ts'
import {
  CLUB_COUNT,
  FIXTURES_PER_ROUND,
  TOTAL_ROUNDS,
  fixturesOn,
  generateFixtures,
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
