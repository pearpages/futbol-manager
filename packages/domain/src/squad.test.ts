import { describe, expect, it } from 'vitest'
import type { Club } from './entities.ts'
import { bestXI, FORMATION_NAMES, startersOf, teamRating, worstXI } from './lineup.ts'
import { ageOn, overall } from './player.ts'
import { createRng } from './rng.ts'
import { generateSquad, SQUAD_SIZE } from './squad.ts'
import { TEST_CLUBS } from './test-clubs.ts'
import { fromCivil } from './time.ts'

const seasonStart = fromCivil(2026, 8, 15)
const names = Array.from({ length: 40 }, (_, i) => `Player ${i + 1}`)
const options = { names, seasonStart }

const squadFor = (club: Club, seed = 1) => generateSquad(club, createRng(seed), options)
const strongest = TEST_CLUBS[0] as Club
const weakest = TEST_CLUBS.at(-1) as Club

describe('generateSquad', () => {
  it('builds a full squad with a workable shape', () => {
    const squad = squadFor(strongest)
    expect(squad).toHaveLength(SQUAD_SIZE)
    expect(squad.filter((p) => p.position === 'GK')).toHaveLength(3)
    expect(squad.filter((p) => p.position === 'DF')).toHaveLength(8)
    expect(squad.filter((p) => p.position === 'MF')).toHaveLength(7)
    expect(squad.filter((p) => p.position === 'FW')).toHaveLength(5)
  })

  it('gives every player a unique id', () => {
    const squad = squadFor(strongest)
    expect(new Set(squad.map((p) => p.id)).size).toBe(SQUAD_SIZE)
  })

  it('is deterministic for a seed and differs between seeds', () => {
    expect(squadFor(strongest, 7)).toEqual(squadFor(strongest, 7))
    expect(squadFor(strongest, 7)).not.toEqual(squadFor(strongest, 8))
  })

  it('supports every formation', () => {
    const squad = squadFor(strongest)
    // `FORMATION_NAMES`, never a literal list — a hardcoded four is how a new
    // shape gets added and silently never tested here.
    for (const formation of FORMATION_NAMES) {
      expect(() => startersOf(squad, bestXI(squad, formation))).not.toThrow()
    }
  })

  it('ages players between 17 and 35', () => {
    for (const club of TEST_CLUBS) {
      for (const player of squadFor(club as Club)) {
        const age = ageOn(player, seasonStart)
        expect(age).toBeGreaterThanOrEqual(17)
        expect(age).toBeLessThanOrEqual(35)
      }
    }
  })

  it('gives outfield players no goalkeeping ability, and keepers plenty', () => {
    const squad = squadFor(strongest)
    for (const player of squad) {
      // On the 60–94 scale an outfielder's dead `keeping` sits just above 40 —
      // below every real rating, which is the point, but no longer near 1.
      if (player.position === 'GK') expect(player.attributes.keeping).toBeGreaterThan(58)
      else expect(player.attributes.keeping).toBeLessThan(52)
    }
  })

  it('specialises by position rather than producing generalists', () => {
    // Asserted over the whole position group, not one player. The separation between
    // a key attribute and the rest is about five points on this scale while `NOISE` is
    // ±3, so any single defender can come out even — picking `find`'s first match made
    // this a coin toss rather than a claim about generation.
    const squad = squadFor(strongest)
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
    const of = (position: string, key: 'tackling' | 'finishing') =>
      mean(squad.filter((p) => p.position === position).map((p) => p.attributes[key]))

    expect(of('DF', 'tackling')).toBeGreaterThan(of('DF', 'finishing'))
    expect(of('FW', 'finishing')).toBeGreaterThan(of('FW', 'tackling'))
  })

  it('makes the first-choice player better than the last of their position', () => {
    const squad = squadFor(strongest)
    const keepers = squad.filter((p) => p.position === 'GK')
    const first = keepers[0]
    const last = keepers.at(-1)
    if (first === undefined || last === undefined) throw new Error('missing keepers')
    expect(overall(first)).toBeGreaterThan(overall(last))
  })
})

describe('round trip back to club strength', () => {
  // The requirement M2's calibration rests on: if a squad does not collapse back
  // to the club rating it was generated from, every harness band moves.

  it.each(TEST_CLUBS.map((c) => [c.name, c] as const))(
    'reproduces %s’s rating from its best XI',
    (_name, club) => {
      const squad = squadFor(club as Club)
      const rating = teamRating(startersOf(squad, bestXI(squad, '4-4-2')))

      expect(rating.attack).toBeGreaterThanOrEqual(club.attack - 3)
      expect(rating.attack).toBeLessThanOrEqual(club.attack + 3)
      expect(rating.defence).toBeGreaterThanOrEqual(club.defence - 3)
      expect(rating.defence).toBeLessThanOrEqual(club.defence + 3)
    },
  )

  it('preserves the gap between the strongest and weakest clubs', () => {
    const strong = squadFor(strongest)
    const weak = squadFor(weakest)
    const strongRating = teamRating(startersOf(strong, bestXI(strong, '4-4-2')))
    const weakRating = teamRating(startersOf(weak, bestXI(weak, '4-4-2')))

    expect(strongRating.attack - weakRating.attack).toBeGreaterThan(14)
    expect(strongRating.defence - weakRating.defence).toBeGreaterThan(14)
  })

  it('holds across seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const squad = squadFor(strongest, seed)
      const rating = teamRating(startersOf(squad, bestXI(squad, '4-4-2')))
      expect(Math.abs(rating.attack - strongest.attack)).toBeLessThanOrEqual(3)
      expect(Math.abs(rating.defence - strongest.defence)).toBeLessThanOrEqual(3)
    }
  })

  it('rates the worst legal XI clearly below the best', () => {
    const squad = squadFor(strongest)
    const best = teamRating(startersOf(squad, bestXI(squad, '4-4-2')))
    const worst = teamRating(startersOf(squad, worstXI(squad, '4-4-2')))

    expect(best.attack).toBeGreaterThan(worst.attack + 3)
    expect(best.defence).toBeGreaterThan(worst.defence + 3)
  })
})
