import { describe, expect, it } from 'vitest'
import { CLUB_COUNT, generateFixtures, defaultSeasonStart } from '@fm/domain'
import { DEFAULT_CLUBS } from './index.ts'

describe('DEFAULT_CLUBS', () => {
  it('provides exactly the 20 clubs a Primera season needs', () => {
    expect(DEFAULT_CLUBS).toHaveLength(CLUB_COUNT)
  })

  it('has unique ids, names and short names', () => {
    // Names matter now that clubs are named after cities: two entries sharing a
    // city would make the table ambiguous, and a duplicate id would silently
    // collapse two clubs into one during fixture generation.
    expect(new Set(DEFAULT_CLUBS.map((c) => c.id)).size).toBe(CLUB_COUNT)
    expect(new Set(DEFAULT_CLUBS.map((c) => c.name)).size).toBe(CLUB_COUNT)
    expect(new Set(DEFAULT_CLUBS.map((c) => c.shortName)).size).toBe(CLUB_COUNT)
  })

  it('uses three-letter short names, which the table renderer assumes', () => {
    expect(DEFAULT_CLUBS.every((c) => c.shortName.length === 3)).toBe(true)
  })

  it('drives fixture generation across the workspace boundary', () => {
    // Also proves data → domain still resolves, which the placeholder test did.
    const fixtures = generateFixtures(
      DEFAULT_CLUBS.map((c) => c.id),
      defaultSeasonStart(2026),
    )
    expect(fixtures).toHaveLength(380)
  })
})
