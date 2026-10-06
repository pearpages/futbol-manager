import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { newSeason } from './simulate.ts'
import { isGameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

describe('isGameState — is this a career, or something that only claims to be', () => {
  const game = () =>
    JSON.parse(
      JSON.stringify(newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng: createRng(1) })),
    ) as Record<string, unknown>

  it('accepts a career that has been through JSON', () => {
    expect(isGameState(game())).toBe(true)
  })

  it('refuses what is not an object', () => {
    for (const value of [null, undefined, 'game', 42, []]) expect(isGameState(value)).toBe(false)
  })

  it('refuses a career missing anything the first screen reads', () => {
    for (const field of ['clubs', 'season', 'competition', 'squads', 'lineups', 'bids', 'board']) {
      const broken = game()
      delete broken[field]
      expect(isGameState(broken), field).toBe(false)
    }
  })

  it('refuses a date that is not a day number', () => {
    const broken = game()
    broken['season'] = { ...(broken['season'] as object), currentDate: '2026-08-15' }
    expect(isGameState(broken)).toBe(false)
  })

  it('refuses a managed club that is not in the league, or has no squad', () => {
    const stranger = game()
    stranger['managedClubId'] = 'nobody'
    expect(isGameState(stranger)).toBe(false)

    const unsquadded = game()
    const id = unsquadded['managedClubId'] as string
    unsquadded['squads'] = { ...(unsquadded['squads'] as object), [id]: null }
    expect(isGameState(unsquadded)).toBe(false)
  })
})
