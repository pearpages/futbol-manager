import { describe, expect, it } from 'vitest'
import { addDays, dayOfWeek, daysBetween, formatDate, fromCivil, toCivil } from './time.ts'

describe('civil date conversion', () => {
  it('round-trips every day from 1900 to 2300', () => {
    // The whole point of concentrating calendar risk in one function: it can be
    // proved exhaustively rather than sampled. ~146k iterations, milliseconds.
    let day = fromCivil(1900, 1, 1)
    const end = fromCivil(2300, 1, 1)
    let checked = 0

    while (day < end) {
      const { y, m, d } = toCivil(day)
      expect(fromCivil(y, m, d)).toBe(day)
      day = addDays(day, 1)
      checked++
    }

    expect(checked).toBeGreaterThan(146_000)
  })

  it('is sequential — consecutive days never repeat or skip', () => {
    let day = fromCivil(2026, 1, 1)
    for (let i = 0; i < 800; i++) {
      const next = addDays(day, 1)
      expect(daysBetween(day, next)).toBe(1)
      expect(toCivil(next)).not.toEqual(toCivil(day))
      day = next
    }
  })

  it.each([
    [1970, 1, 1, 0],
    [1969, 12, 31, -1],
    [2000, 3, 1, 11017],
    [2026, 8, 15, 20680],
  ])('anchors %i-%i-%i at day %i', (y, m, d, expected) => {
    expect(fromCivil(y, m, d)).toBe(expected)
  })

  it('handles the century leap-year rules', () => {
    // 2000 was a leap year (divisible by 400); 1900 and 2100 were not.
    expect(daysBetween(fromCivil(2000, 2, 28), fromCivil(2000, 3, 1))).toBe(2)
    expect(daysBetween(fromCivil(1900, 2, 28), fromCivil(1900, 3, 1))).toBe(1)
    expect(daysBetween(fromCivil(2100, 2, 28), fromCivil(2100, 3, 1))).toBe(1)
    expect(toCivil(fromCivil(2000, 2, 29))).toEqual({ y: 2000, m: 2, d: 29 })
  })

  it('handles year and month boundaries', () => {
    expect(toCivil(addDays(fromCivil(2026, 12, 31), 1))).toEqual({ y: 2027, m: 1, d: 1 })
    expect(toCivil(addDays(fromCivil(2026, 1, 31), 1))).toEqual({ y: 2026, m: 2, d: 1 })
    expect(toCivil(addDays(fromCivil(2027, 1, 1), -1))).toEqual({ y: 2026, m: 12, d: 31 })
  })

  it('works before the epoch, for birth dates of veteran players', () => {
    expect(toCivil(fromCivil(1930, 6, 15))).toEqual({ y: 1930, m: 6, d: 15 })
    expect(fromCivil(1930, 6, 15)).toBeLessThan(0)
  })
})

describe('dayOfWeek', () => {
  it.each([
    [fromCivil(1970, 1, 1), 4], // Thursday
    [fromCivil(2026, 8, 15), 6], // Saturday
    [fromCivil(2026, 8, 16), 0], // Sunday
    [fromCivil(1969, 12, 31), 3], // Wednesday
  ])('identifies the weekday', (day, expected) => {
    expect(dayOfWeek(day)).toBe(expected)
  })

  it('cycles with period 7 in both directions', () => {
    const base = fromCivil(2026, 8, 15)
    for (let i = -20; i <= 20; i++) {
      expect(dayOfWeek(addDays(base, i * 7))).toBe(dayOfWeek(base))
    }
  })
})

describe('formatDate', () => {
  it('pads to ISO-like output', () => {
    expect(formatDate(fromCivil(2026, 8, 5))).toBe('2026-08-05')
    expect(formatDate(fromCivil(999, 1, 1))).toBe('0999-01-01')
  })
})
