import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '@fm/domain'
import { INTL_NAMES } from './names-intl.ts'

/**
 * The pools clubs abroad draw from.
 *
 * Both properties here were defects first. Generation indexes these lists
 * **sequentially**, so their order is not cosmetic.
 */

describe('the international name pools', () => {
  it('gives every country a pool big enough for its clubs', () => {
    for (const country of COUNTRIES) {
      // Six clubs of ~23, and a slice each, with room to drift over a career.
      expect(INTL_NAMES[country].length, country).toBeGreaterThan(600)
    }
  })

  it('never repeats a name, within a country or across them', () => {
    const all = COUNTRIES.flatMap((country) => INTL_NAMES[country])
    expect(new Set(all).size).toBe(all.length)
  })

  it('varies the given name from one entry to the next', () => {
    // **The defect this is for.** Built as `given.flatMap(surnames)`, the first
    // twenty-three entries share a given name — and `generateSquad` takes exactly
    // the first twenty-three. München fielded twenty-three men called Andreas,
    // and nothing failed; it took looking at the squad.
    for (const country of COUNTRIES) {
      const firstNames = INTL_NAMES[country].slice(0, 23).map((name) => name.split(' ')[0])
      expect(new Set(firstNames).size, country).toBeGreaterThan(15)
    }
  })

  it('varies the surname too', () => {
    for (const country of COUNTRIES) {
      const surnames = INTL_NAMES[country]
        .slice(0, 23)
        .map((name) => name.split(' ').slice(1).join(' '))
      expect(new Set(surnames).size, country).toBeGreaterThan(15)
    }
  })
})
