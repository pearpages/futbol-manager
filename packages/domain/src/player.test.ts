import { describe, expect, it } from 'vitest'
import {
  ageOn,
  type Attributes,
  ATTRIBUTE_KEYS,
  overall,
  type Player,
  type PlayerId,
  POSITION_WEIGHTS,
  POSITIONS,
  type Position,
} from './player.ts'
import { fromCivil } from './time.ts'

const attrs = (value: number, overrides: Partial<Attributes> = {}): Attributes => ({
  pace: value,
  finishing: value,
  passing: value,
  dribbling: value,
  tackling: value,
  heading: value,
  keeping: value,
  stamina: value,
  ...overrides,
})

const player = (position: Position, attributes: Attributes, birthYear = 2000): Player => ({
  id: 'p1' as PlayerId,
  name: 'Test Player',
  position,
  birthDate: fromCivil(birthYear, 6, 15),
  attributes,
})

describe('POSITION_WEIGHTS', () => {
  it.each(POSITIONS)('sums to exactly 1.00 for %s', (position) => {
    // A drifting row would rescale every rating in the game without any other
    // symptom, so this is checked exactly rather than approximately.
    const weights = POSITION_WEIGHTS[position]
    const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + weights[key], 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('never uses a negative weight', () => {
    for (const position of POSITIONS) {
      for (const key of ATTRIBUTE_KEYS) {
        expect(POSITION_WEIGHTS[position][key]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('gives keeping to goalkeepers and nobody else', () => {
    expect(POSITION_WEIGHTS.GK.keeping).toBeGreaterThan(0.5)
    expect(POSITION_WEIGHTS.DF.keeping).toBe(0)
    expect(POSITION_WEIGHTS.MF.keeping).toBe(0)
    expect(POSITION_WEIGHTS.FW.keeping).toBe(0)
  })
})

describe('overall', () => {
  it('returns the attribute value when every attribute is equal', () => {
    // Follows from the weights summing to 1, and is the cleanest statement of it.
    for (const position of POSITIONS) {
      expect(overall(player(position, attrs(70)))).toBe(70)
    }
  })

  it('ignores a keeper’s finishing and is dominated by their keeping', () => {
    const base = player('GK', attrs(50))
    const clinicalKeeper = player('GK', attrs(50, { finishing: 99 }))
    const goodKeeper = player('GK', attrs(50, { keeping: 99 }))

    expect(overall(clinicalKeeper)).toBe(overall(base))
    expect(overall(goodKeeper)).toBeGreaterThan(overall(base) + 30)
  })

  it('ignores a striker’s tackling and is dominated by their finishing', () => {
    const base = player('FW', attrs(50))
    expect(overall(player('FW', attrs(50, { tackling: 99 })))).toBe(overall(base))
    expect(overall(player('FW', attrs(50, { finishing: 99 })))).toBeGreaterThan(overall(base) + 12)
  })

  it('values the same attributes differently by position', () => {
    const withTackling = attrs(50, { tackling: 90 })
    expect(overall(player('DF', withTackling))).toBeGreaterThan(overall(player('MF', withTackling)))
    expect(overall(player('MF', withTackling))).toBeGreaterThan(overall(player('FW', withTackling)))
  })

  it('stays within 1–99 at the extremes', () => {
    for (const position of POSITIONS) {
      expect(overall(player(position, attrs(99)))).toBe(99)
      expect(overall(player(position, attrs(1)))).toBe(1)
    }
  })
})

describe('ageOn', () => {
  const born = (y: number, m: number, d: number): Player => ({
    id: 'p' as PlayerId,
    name: 'x',
    position: 'MF',
    birthDate: fromCivil(y, m, d),
    attributes: attrs(50),
  })

  it('counts completed years', () => {
    expect(ageOn(born(2000, 6, 15), fromCivil(2026, 6, 15))).toBe(26)
    expect(ageOn(born(2000, 6, 15), fromCivil(2026, 8, 1))).toBe(26)
  })

  it('does not count a birthday that has not happened yet', () => {
    expect(ageOn(born(2000, 6, 15), fromCivil(2026, 6, 14))).toBe(25)
    expect(ageOn(born(2000, 12, 31), fromCivil(2026, 1, 1))).toBe(25)
  })

  it('handles a 29 February birthday', () => {
    // Ages on 1 March in a non-leap year, not on 28 February.
    const leapling = born(2004, 2, 29)
    expect(ageOn(leapling, fromCivil(2027, 2, 28))).toBe(22)
    expect(ageOn(leapling, fromCivil(2027, 3, 1))).toBe(23)
    expect(ageOn(leapling, fromCivil(2028, 2, 29))).toBe(24)
  })

  it('works for players born before the epoch', () => {
    expect(ageOn(born(1965, 3, 10), fromCivil(2026, 3, 10))).toBe(61)
  })
})
