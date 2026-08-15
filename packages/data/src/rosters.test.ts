import { describe, expect, it } from 'vitest'
import {
  bestXI,
  createRng,
  defaultSeasonStart,
  FORMATION_NAMES,
  FORMATIONS,
  generateSquad,
  ageOn,
  MAX_SQUAD,
  MIN_SQUAD,
  overall,
  type Position,
  teamRating,
} from '@fm/domain'
import { DEFAULT_CLUBS } from './clubs.ts'
import { DEFAULT_ROSTERS } from './rosters.ts'

/**
 * The shipped rosters, checked where the statistical harness cannot see them.
 *
 * `TEST_CLUBS` carries no rosters, so every band in `domain` still runs on
 * *generated* squads. That is a deliberate trade — mirroring five hundred rows into
 * `domain` to satisfy its no-content rule would be a second copy to keep in step —
 * and these are the tests that pay for it: they assert the two properties the bands
 * would otherwise have covered.
 */

const START = defaultSeasonStart(2026)
const squadFor = (clubId: string, seed = 1) => {
  const club = DEFAULT_CLUBS.find((c) => c.id === clubId)
  /* c8 ignore next */
  if (club === undefined) throw new Error(`no club ${clubId}`)
  const roster = DEFAULT_ROSTERS[clubId]
  /* c8 ignore next */
  if (roster === undefined) throw new Error(`no roster ${clubId}`)
  return generateSquad(club, createRng(seed), { names: [], seasonStart: START, roster })
}

describe('coverage', () => {
  it('gives every club in the league a roster, and none to the others', () => {
    const league = new Set(DEFAULT_CLUBS.map((c) => c.id))
    expect(Object.keys(DEFAULT_ROSTERS).sort()).toEqual([...league].sort())
  })

  it('stays inside the squad size limits the reducer enforces', () => {
    for (const [club, roster] of Object.entries(DEFAULT_ROSTERS)) {
      expect(roster.length, club).toBeGreaterThanOrEqual(MIN_SQUAD)
      expect(roster.length, club).toBeLessThanOrEqual(MAX_SQUAD)
    }
  })

  it('does not make every squad the same size — the point is that they are real', () => {
    // A guard on the guard: 23 everywhere would satisfy the limits above and mean
    // the roster had been normalised back onto the generator's flat shape.
    const sizes = new Set(Object.values(DEFAULT_ROSTERS).map((r) => r.length))
    expect(sizes.size).toBeGreaterThan(3)
  })
})

describe('every formation is playable', () => {
  // A squad short at one position throws out of `bestXI` rather than failing
  // politely, so this is a crash guard as much as a content one. It is also the
  // constraint that decided how wingers were assigned: no fixed mapping satisfies
  // both 3-5-2 (five midfielders) and 4-3-3 (three forwards).
  it.each(Object.keys(DEFAULT_ROSTERS))('%s can field all four', (club) => {
    const roster = DEFAULT_ROSTERS[club] ?? []
    for (const formation of FORMATION_NAMES) {
      for (const position of ['GK', 'DF', 'MF', 'FW'] as Position[]) {
        const have = roster.filter((p) => p.position === position).length
        expect(have, `${club} ${formation} ${position}`).toBeGreaterThanOrEqual(
          FORMATIONS[formation][position],
        )
      }
    }
  })

  it('actually builds an XI for each', () => {
    for (const club of Object.keys(DEFAULT_ROSTERS)) {
      const squad = squadFor(club)
      for (const formation of FORMATION_NAMES) {
        expect(() => bestXI(squad, formation), `${club} ${formation}`).not.toThrow()
      }
    }
  })
})

describe('the round trip still holds', () => {
  /**
   * The load-bearing property, and the reason a real roster is safe to drop in.
   *
   * A roster supplies the *shape* of a squad — who is a keeper, how old he is, who
   * is first choice — while `calibrateSquad` still collapses the finished squad onto
   * the club's `attack`/`defence`. If that stopped holding, every M2/M3/M5 band would
   * be measuring a different league from the one the game ships.
   */
  it.each(DEFAULT_CLUBS.map((c) => c.id))('%s collapses back onto its rating', (clubId) => {
    const club = DEFAULT_CLUBS.find((c) => c.id === clubId)
    /* c8 ignore next */
    if (club === undefined) throw new Error('no club')
    const rating = teamRating(startersOf(squadFor(clubId)))

    expect(Math.abs(rating.attack - club.attack), `${clubId} attack`).toBeLessThanOrEqual(3)
    expect(Math.abs(rating.defence - club.defence), `${clubId} defence`).toBeLessThanOrEqual(3)
  })

  it('holds across seeds', () => {
    for (const seed of [7, 99, 20260815]) {
      const club = DEFAULT_CLUBS[0]
      /* c8 ignore next */
      if (club === undefined) throw new Error('no club')
      const rating = teamRating(startersOf(squadFor(club.id, seed)))
      expect(Math.abs(rating.attack - club.attack)).toBeLessThanOrEqual(3)
    }
  })

  it('preserves the pecking order between strongest and weakest', () => {
    const first = DEFAULT_CLUBS[0]
    const last = DEFAULT_CLUBS[DEFAULT_CLUBS.length - 1]
    /* c8 ignore next */
    if (first === undefined || last === undefined) throw new Error('no clubs')
    const strong = teamRating(startersOf(squadFor(first.id)))
    const weak = teamRating(startersOf(squadFor(last.id)))
    expect(strong.attack + strong.defence - (weak.attack + weak.defence)).toBeGreaterThan(30)
  })
})

describe('ages are real, and usable', () => {
  it('keeps the league mean where the market harness expects it', () => {
    // Retirement starts at 33 and youth intake replaces it. A league that opened
    // outside this band would drift somewhere the career tests cannot follow.
    const ages = Object.values(DEFAULT_ROSTERS).flatMap((r) => r.map((p) => p.age))
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length
    expect(mean).toBeGreaterThan(20)
    expect(mean).toBeLessThan(33)
  })

  it('spans a real range rather than clustering', () => {
    const ages = Object.values(DEFAULT_ROSTERS).flatMap((r) => r.map((p) => p.age))
    expect(Math.min(...ages)).toBeLessThan(20)
    expect(Math.max(...ages)).toBeGreaterThan(35)
  })

  it('carries each age onto the player rather than drawing one', () => {
    // The whole reason to take a roster: a 39-year-old is on the books because the
    // real squad had one, not because a triangular draw happened to go high. Only
    // the day within the birth year is still drawn, so the age can read one year
    // low depending on where that day lands relative to the season start.
    for (const clubId of Object.keys(DEFAULT_ROSTERS)) {
      const roster = DEFAULT_ROSTERS[clubId] ?? []
      const byName = new Map(squadFor(clubId).map((p) => [p.name, p]))

      for (const entry of roster) {
        const player = byName.get(entry.name)
        /* c8 ignore next */
        if (player === undefined) throw new Error(`missing ${entry.name}`)
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
    for (const clubId of Object.keys(DEFAULT_ROSTERS)) {
      const roster = DEFAULT_ROSTERS[clubId] ?? []
      const squad = squadFor(clubId)
      const byName = new Map(squad.map((p) => [p.name, p]))

      for (const position of ['GK', 'DF', 'MF', 'FW'] as Position[]) {
        const ranked = roster
          .filter((p) => p.position === position)
          .sort((a, b) => b.value - a.value)
        const top = ranked[0]
        const bottom = ranked[ranked.length - 1]
        if (top === undefined || bottom === undefined || top === bottom) continue

        const best = byName.get(top.name)
        const worst = byName.get(bottom.name)
        /* c8 ignore next */
        if (best === undefined || worst === undefined) throw new Error('missing player')
        expect(overall(best), `${clubId} ${position}`).toBeGreaterThanOrEqual(overall(worst))

        // Strictly better only when the money says so. Generation reads the value
        // *magnitude* now, not the rank, so two players a club values identically —
        // Sevilla's two €3M keepers — come out identical, which is the point rather
        // than a failure. Asserting `>` on rank order is what the old rank-only
        // generator guaranteed and this one deliberately does not.
        if (top.value >= bottom.value * 2) {
          expect(overall(best), `${clubId} ${position}`).toBeGreaterThan(overall(worst))
        }
      }
    }
  })
})

function startersOf(squad: ReturnType<typeof squadFor>) {
  const lineup = bestXI(squad, '4-4-2')
  const byId = new Map(squad.map((p) => [p.id, p]))
  return lineup.starters.flatMap((id) => {
    const player = byId.get(id)
    /* c8 ignore next */
    return player === undefined ? [] : [player]
  })
}
