import { describe, expect, it } from 'vitest'
import {
  ageOn,
  bestXI,
  COVER_AT_POSITION,
  defaultSeasonStart,
  FORMATION_NAMES,
  FORMATIONS,
  generateForeignLeague,
  MAX_SQUAD,
  MIN_SQUAD,
  overall,
  POSITIONS,
  referenceValues,
  startersOf,
  teamRating,
  BALANCED,
} from '@fm/domain'
import { FOREIGN_CLUBS } from './foreign-clubs.ts'
import { FOREIGN_ROSTERS } from './foreign-rosters.ts'
import { DEFAULT_ROSTERS } from './rosters.ts'
import { INTL_NAMES } from './names-intl.ts'

/**
 * The shipped squads abroad, checked where the statistical harness cannot see
 * them.
 *
 * `TEST_FOREIGN_CLUBS` in `domain` uses ids (`en-f1`) that deliberately do not
 * match the shipped ones, so `market.foreign.harness.test.ts` keeps measuring
 * *generated* squads — the same trade `TEST_CLUBS` makes at home. These are the
 * tests that pay for it.
 */

const START = defaultSeasonStart(2026)

/** The whole world's norm, exactly as `store.ts` builds it. */
const REFERENCE = referenceValues([
  ...Object.values(DEFAULT_ROSTERS),
  ...Object.values(FOREIGN_ROSTERS),
])

const LEAGUE = generateForeignLeague(FOREIGN_CLUBS, 2026, {
  names: INTL_NAMES,
  seasonStart: START,
  rosters: FOREIGN_ROSTERS,
  reference: REFERENCE,
})

const squadFor = (clubId: string) => LEAGUE.squads[clubId] ?? []

describe('coverage', () => {
  it('gives every club abroad a roster, and none to anybody else', () => {
    expect(Object.keys(FOREIGN_ROSTERS).sort()).toEqual(FOREIGN_CLUBS.map((c) => c.id).sort())
  })

  it('stays inside the squad size limits the reducer enforces', () => {
    for (const [clubId, roster] of Object.entries(FOREIGN_ROSTERS)) {
      expect(roster.length, clubId).toBeGreaterThanOrEqual(MIN_SQUAD)
      expect(roster.length, clubId).toBeLessThanOrEqual(MAX_SQUAD)
    }
  })

  it('does not make every squad the same size', () => {
    // Real squads are lumpy, and flattening them is the specific thing this whole
    // data set exists to avoid.
    const sizes = new Set(Object.values(FOREIGN_ROSTERS).map((r) => r.length))
    expect(sizes.size).toBeGreaterThan(3)
  })
})

describe('every formation is playable', () => {
  it.each(FOREIGN_CLUBS.map((c) => c.id))('%s can field every shape', (clubId) => {
    const squad = squadFor(clubId)
    for (const formation of FORMATION_NAMES) {
      for (const position of POSITIONS) {
        const have = squad.filter((p) => p.position === position).length
        expect(have, `${clubId} ${formation} ${position}`).toBeGreaterThanOrEqual(
          FORMATIONS[formation][position],
        )
      }
      expect(
        () => startersOf(squad, bestXI(squad, formation)),
        `${clubId} ${formation}`,
      ).not.toThrow()
    }
  })

  it.each(FOREIGN_CLUBS.map((c) => c.id))('%s keeps cover at every position', (clubId) => {
    // Stricter than fielding an XI, and it is what `canSpare` demands — a club
    // that cannot lose one player without breaking a shape can never sell anybody,
    // which quietly removes it from the market.
    const squad = squadFor(clubId)
    for (const position of POSITIONS) {
      expect(
        squad.filter((p) => p.position === position).length,
        `${clubId} ${position}`,
      ).toBeGreaterThanOrEqual(COVER_AT_POSITION[position])
    }
  })
})

describe('the round trip still holds', () => {
  it.each(FOREIGN_CLUBS.map((c) => [c.id, c.rating] as const))(
    '%s collapses back onto its rating',
    (clubId, rating) => {
      // A roster supplies the *shape*; the club rating supplies the *level*. If
      // this drifts, squad generation has started deciding how good a club is.
      const squad = squadFor(clubId)
      const team = teamRating(startersOf(squad, bestXI(squad, '4-4-2')), BALANCED)
      expect(Math.abs(team.attack - rating), `${clubId} attack`).toBeLessThanOrEqual(3)
      expect(Math.abs(team.defence - rating), `${clubId} defence`).toBeLessThanOrEqual(3)
    },
  )

  it('preserves the pecking order between the strongest and the weakest', () => {
    const strongest = FOREIGN_CLUBS.reduce((a, b) => (a.rating >= b.rating ? a : b))
    const weakest = FOREIGN_CLUBS.reduce((a, b) => (a.rating <= b.rating ? a : b))
    const of = (id: string) => {
      const squad = squadFor(id)
      const t = teamRating(startersOf(squad, bestXI(squad, '4-4-2')), BALANCED)
      return t.attack + t.defence
    }
    expect(of(strongest.id) - of(weakest.id)).toBeGreaterThan(15)
  })
})

describe('ages are real, and usable', () => {
  const all = Object.values(FOREIGN_ROSTERS).flat()

  it('keeps the mean where the harness expects it', () => {
    const mean = all.reduce((sum, e) => sum + e.age, 0) / all.length
    expect(mean).toBeGreaterThan(20)
    expect(mean).toBeLessThan(33)
  })

  it('spans a real range rather than clustering', () => {
    // A 40-year-old on a last contract and a teenager are most of what makes a
    // squad screen worth reading.
    expect(Math.min(...all.map((e) => e.age))).toBeLessThan(20)
    expect(Math.max(...all.map((e) => e.age))).toBeGreaterThan(35)
  })

  it('carries each age onto the player rather than drawing one', () => {
    for (const [clubId, roster] of Object.entries(FOREIGN_ROSTERS)) {
      const squad = squadFor(clubId)
      for (const entry of roster) {
        const player = squad.find((p) => p.name === entry.name)
        if (player === undefined) throw new Error(`missing ${entry.name} at ${clubId}`)
        expect(ageOn(player, START), `${clubId} ${entry.name}`).toBeGreaterThanOrEqual(
          entry.age - 1,
        )
        expect(ageOn(player, START), `${clubId} ${entry.name}`).toBeLessThanOrEqual(entry.age)
      }
    }
  })
})

describe('value orders a position group and nothing else', () => {
  it('makes the best-valued player at a position the first choice', () => {
    for (const clubId of Object.keys(FOREIGN_ROSTERS)) {
      const squad = squadFor(clubId)
      for (const position of POSITIONS) {
        const group = (FOREIGN_ROSTERS[clubId] ?? [])
          .filter((e) => e.position === position)
          .sort((a, b) => b.value - a.value)
        const top = group[0]
        const bottom = group.at(-1)
        if (top === undefined || bottom === undefined || top === bottom) continue

        const best = squad.find((p) => p.name === top.name)
        const worst = squad.find((p) => p.name === bottom.name)
        if (best === undefined || worst === undefined) continue

        expect(overall(best), `${clubId} ${position}`).toBeGreaterThanOrEqual(overall(worst))
        // Ties are fine by design; a clear gap in value must show as a clear gap
        // in quality.
        if (top.value >= bottom.value * 2) {
          expect(overall(best), `${clubId} ${position}`).toBeGreaterThan(overall(worst))
        }
      }
    }
  })

  it('lets the outfield stars outrank the goalkeepers', () => {
    // **What the pooled value norm buys, and nothing else pinned it.** Measured
    // against the foreign rosters alone, the norm is taken from thirty-two of the
    // richest clubs in Europe — which have no cheap tail — so every position's
    // spread comes out the same and a first-choice keeper reads as big a star as
    // a €120M forward. The top-rated player was a keeper at **22 of 32** clubs.
    //
    // Pooling the domestic rosters in takes the clear cases from 13 to 7. A
    // residual gap to the domestic set (1 of 20) remains and is a known cost of
    // selecting only elite clubs; **the lever is the `value` column, never the
    // code.** Reverting to a foreign-only norm fails this and nothing else.
    const clear = FOREIGN_CLUBS.filter((club) => {
      const squad = squadFor(club.id)
      const keeper = Math.max(...squad.filter((p) => p.position === 'GK').map(overall))
      const outfield = Math.max(...squad.filter((p) => p.position !== 'GK').map(overall))
      return keeper - outfield >= 2
    })
    expect(clear.length).toBeLessThan(10)
  })

  it('gives the stars a squad they stand out in', () => {
    // **What the value column is for.** Before it was populated properly, every
    // squad abroad was the same flat block and the whole point of shipping real
    // shapes was lost.
    const spreads = FOREIGN_CLUBS.map((club) => {
      const rated = squadFor(club.id).map(overall)
      return Math.max(...rated) - Math.min(...rated)
    })
    const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length
    expect(mean).toBeGreaterThan(6)
  })
})
