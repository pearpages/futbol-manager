import { describe, expect, it } from 'vitest'
import { createRng, type RngState } from './rng.ts'

const draw = (rng: { next(): number }, n: number): number[] =>
  Array.from({ length: n }, () => rng.next())

describe('createRng', () => {
  it('produces an identical sequence for the same seed', () => {
    expect(draw(createRng(20260813), 1000)).toEqual(draw(createRng(20260813), 1000))
  })

  it('resumes exactly after a JSON round-trip of its state', () => {
    // The test M0 exists for. A save written mid-season must produce the same
    // remaining season an uninterrupted run would have.
    const interrupted = createRng(7)
    const continuous = createRng(7)

    draw(interrupted, 500)
    draw(continuous, 500)

    const serialised = JSON.stringify(interrupted.state())
    const revived = createRng(JSON.parse(serialised) as RngState)

    expect(draw(revived, 500)).toEqual(draw(continuous, 500))
  })

  it('round-trips its state losslessly through JSON', () => {
    const rng = createRng(99)
    draw(rng, 17)
    const state = rng.state()

    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
    expect(state).toHaveLength(4)
    for (const word of state) {
      expect(Number.isInteger(word)).toBe(true)
      expect(word).toBeGreaterThanOrEqual(0)
      expect(word).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('diverges for different seeds', () => {
    expect(draw(createRng(1), 100)).not.toEqual(draw(createRng(2), 100))
  })

  it('diverges for adjacent low-entropy seeds', () => {
    // Without the splitmix32 expansion and the warm-up, seeds 1/2/3 correlate
    // visibly in the first draws — and fixtures use exactly those seeds.
    const first = draw(createRng(1), 5)
    const second = draw(createRng(2), 5)
    const third = draw(createRng(3), 5)

    expect(new Set([...first, ...second, ...third]).size).toBe(15)
  })

  it('stays within [0, 1)', () => {
    for (const value of draw(createRng(42), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('distributes roughly uniformly', () => {
    // Catches a transcription error in the algorithm that determinism tests
    // would happily report as deterministic. n=100k, 10 buckets: expected 10,000
    // each with sd ≈ 95, so ±500 is over five standard deviations.
    const buckets = new Array<number>(10).fill(0)
    const rng = createRng(20260813)

    for (let i = 0; i < 100_000; i++) {
      const bucket = Math.floor(rng.next() * 10)
      buckets[bucket] = (buckets[bucket] ?? 0) + 1
    }

    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_500)
      expect(count).toBeLessThan(10_500)
    }
  })
})
