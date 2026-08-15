import { describe, expect, it } from 'vitest'
import type { TeamRating } from './entities.ts'
import { expectedGoals, MODEL, resolveFixture } from './resolve.ts'
import { createRng } from './rng.ts'

/**
 * Properties of the model, deliberately independent of the calibrated constants.
 * These must keep passing while M2 tunes BASE, SLOPE, SCALE and HOME_EDGE — a test
 * that has to move every time a knob turns is not testing the model, it is
 * restating the current settings.
 */

const rating = (attack: number, defence: number, tempo = 0): TeamRating => ({
  attack,
  defence,
  tempo,
})
const EVEN = rating(77, 77)
const STRONG = rating(89, 87)
const WEAK = rating(70, 70)

describe('expectedGoals', () => {
  it('gives the home side a higher expectation than the away side, all else equal', () => {
    expect(expectedGoals(EVEN, EVEN, true)).toBeGreaterThan(expectedGoals(EVEN, EVEN, false))
  })

  it('rises monotonically with attack', () => {
    let previous = 0
    for (let attack = 63; attack <= 90; attack += 3) {
      const current = expectedGoals(rating(attack, 77), EVEN, false)
      expect(current).toBeGreaterThan(previous)
      previous = current
    }
  })

  it('falls monotonically as the opposing defence improves', () => {
    let previous = Infinity
    for (let defence = 63; defence <= 90; defence += 3) {
      const current = expectedGoals(EVEN, rating(77, defence), false)
      expect(current).toBeLessThan(previous)
      previous = current
    }
  })

  it('stays positive and bounded at the rating extremes', () => {
    // A linear model would let λ go negative here. The log scale cannot, and
    // MAX_LAMBDA caps the other end.
    for (const [a, d] of [
      [1, 99],
      [99, 1],
      [1, 1],
      [99, 99],
    ] as const) {
      for (const atHome of [true, false]) {
        const lambda = expectedGoals(rating(a, a), rating(d, d), atHome)
        expect(lambda).toBeGreaterThan(0)
        expect(lambda).toBeLessThanOrEqual(MODEL.MAX_LAMBDA)
        expect(Number.isFinite(lambda)).toBe(true)
      }
    }
  })
})

describe('resolveFixture', () => {
  it('returns non-negative integer scores', () => {
    const rng = createRng(1)
    for (let i = 0; i < 2_000; i++) {
      const { home, away } = resolveFixture(STRONG, WEAK, rng)
      expect(Number.isInteger(home)).toBe(true)
      expect(Number.isInteger(away)).toBe(true)
      expect(home).toBeGreaterThanOrEqual(0)
      expect(away).toBeGreaterThanOrEqual(0)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(resolveFixture(STRONG, WEAK, createRng(9))).toEqual(
      resolveFixture(STRONG, WEAK, createRng(9)),
    )
  })

  it('samples close to the requested mean', () => {
    // Confirms the Knuth sampler is actually Poisson-distributed rather than
    // merely random — a transcription error here would still look deterministic.
    const rng = createRng(4242)
    const n = 20_000
    let total = 0
    for (let i = 0; i < n; i++) total += resolveFixture(EVEN, EVEN, rng).away

    expect(total / n).toBeCloseTo(expectedGoals(EVEN, EVEN, false), 1)
  })

  it('produces a Poisson-shaped spread, not a uniform one', () => {
    // Poisson at λ≈1.3 puts most mass on 0–2 and a thin tail. A uniform model
    // would spread evenly and never produce the 4s and 5s at all.
    const rng = createRng(77)
    const counts = new Map<number, number>()
    for (let i = 0; i < 20_000; i++) {
      const goals = resolveFixture(EVEN, EVEN, rng).away
      counts.set(goals, (counts.get(goals) ?? 0) + 1)
    }

    expect(counts.get(0) ?? 0).toBeGreaterThan(counts.get(2) ?? 0)
    expect(counts.get(1) ?? 0).toBeGreaterThan(counts.get(3) ?? 0)
    expect(counts.get(4) ?? 0).toBeGreaterThan(0) // the tail exists
  })

  it('lets the better side win most of the time, but not always', () => {
    // The single most important behavioural property: without upsets this is a
    // spreadsheet, and with too many, ratings are decoration.
    const rng = createRng(5)
    let strongWins = 0
    let weakWins = 0

    for (let i = 0; i < 5_000; i++) {
      const { home, away } = resolveFixture(STRONG, WEAK, rng)
      if (home > away) strongWins++
      else if (away > home) weakWins++
    }

    expect(strongWins / 5_000).toBeGreaterThan(0.5)
    expect(weakWins).toBeGreaterThan(100)
  })
})
