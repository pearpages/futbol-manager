import { describe, expect, it } from 'vitest'
import type { Club } from './entities.ts'
import {
  BALANCED,
  bestXI,
  FORMATION_NAMES,
  FORMATIONS,
  type Formation,
  playerAttack,
  playerDefence,
  startersOf,
  teamRating,
  worstXI,
} from './lineup.ts'
import type { Attributes, Player, PlayerId } from './player.ts'
import { createRng } from './rng.ts'
import { generateSquad } from './squad.ts'
import { TEST_CLUBS } from './test-clubs.ts'
import { fromCivil } from './time.ts'

const seasonStart = fromCivil(2026, 8, 15)
const names = Array.from({ length: 40 }, (_, i) => `Player ${i + 1}`)
const squad = generateSquad(TEST_CLUBS[0] as Club, createRng(1), { names, seasonStart })

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

describe('FORMATIONS', () => {
  it.each(FORMATION_NAMES)('%s fields exactly 11 with one keeper', (formation: Formation) => {
    const shape = FORMATIONS[formation]
    expect(shape.GK + shape.DF + shape.MF + shape.FW).toBe(11)
    expect(shape.GK).toBe(1)
  })
})

describe('per-player ratings', () => {
  it('gives a goalkeeper no attacking value and their keeping as defence', () => {
    const keeper: Player = {
      id: 'k' as PlayerId,
      name: 'K',
      position: 'GK',
      birthDate: seasonStart,
      attributes: attrs(40, { keeping: 88 }),
    }
    expect(playerAttack(keeper)).toBe(0)
    expect(playerDefence(keeper)).toBe(88)
  })

  it('lets a defender who can finish contribute to attack', () => {
    // Position-independent weights: this is the point of step 1 in the spec.
    const base: Player = {
      id: 'd' as PlayerId,
      name: 'D',
      position: 'DF',
      birthDate: seasonStart,
      attributes: attrs(50),
    }
    const clinical: Player = { ...base, attributes: attrs(50, { finishing: 90 }) }
    expect(playerAttack(clinical)).toBeGreaterThan(playerAttack(base))
  })
})

describe('teamRating', () => {
  it('rates the best XI above the worst', () => {
    const best = teamRating(startersOf(squad, bestXI(squad, '4-4-2')))
    const worst = teamRating(startersOf(squad, worstXI(squad, '4-4-2')))
    expect(best.attack).toBeGreaterThan(worst.attack)
    expect(best.defence).toBeGreaterThan(worst.defence)
  })

  it('moves defence substantially when the keeper is swapped', () => {
    // The keeper carries 35% of the defensive rating alone — deliberate, so a
    // great keeper behind a poor back four visibly matters.
    const lineup = bestXI(squad, '4-4-2')
    const starters = startersOf(squad, lineup)
    const outfield = starters.filter((p) => p.position !== 'GK')
    const keeper = starters.find((p) => p.position === 'GK')
    if (keeper === undefined) throw new Error('no keeper')

    const withGreat = teamRating([
      { ...keeper, attributes: attrs(50, { keeping: 95 }) },
      ...outfield,
    ])
    const withPoor = teamRating([
      { ...keeper, attributes: attrs(50, { keeping: 25 }) },
      ...outfield,
    ])

    expect(withGreat.defence - withPoor.defence).toBeGreaterThan(20)
    expect(withGreat.attack).toBe(withPoor.attack) // and does not touch attack
  })

  it('trades attack against defence in both directions', () => {
    const starters = startersOf(squad, bestXI(squad, '4-4-2'))
    const balanced = teamRating(starters, BALANCED)
    const attacking = teamRating(starters, { attacking: 100 })
    const defensive = teamRating(starters, { attacking: 0 })

    expect(attacking.attack).toBeGreaterThan(balanced.attack)
    expect(attacking.defence).toBeLessThan(balanced.defence)
    expect(defensive.attack).toBeLessThan(balanced.attack)
    expect(defensive.defence).toBeGreaterThan(balanced.defence)
  })

  it('charges more than it pays at either extreme', () => {
    // The property that makes the slider a decision rather than a free win.
    // A symmetric trade is strictly exploitable: under three-points-for-a-win,
    // converting a draw into a 50/50 result is worth +0.5 points on average, so
    // all-out attack would always pay. Measured at +2.1 points a season before
    // this asymmetry existed.
    const starters = startersOf(squad, bestXI(squad, '4-4-2'))
    const total = (r: { attack: number; defence: number }) => r.attack + r.defence
    const balanced = total(teamRating(starters, BALANCED))

    for (const attacking of [0, 10, 25, 75, 90, 100]) {
      expect(total(teamRating(starters, { attacking }))).toBeLessThan(balanced)
    }
  })

  it('charges symmetrically, so neither end is the cheap one', () => {
    const starters = startersOf(squad, bestXI(squad, '4-4-2'))
    const total = (r: { attack: number; defence: number }) => r.attack + r.defence
    expect(total(teamRating(starters, { attacking: 100 }))).toBeCloseTo(
      total(teamRating(starters, { attacking: 0 })),
      0,
    )
  })

  it('rejects a lineup with no goalkeeper', () => {
    const outfield = squad.filter((p) => p.position !== 'GK').slice(0, 11)
    expect(() => teamRating(outfield)).toThrow(/goalkeeper/)
  })
})

describe('startersOf', () => {
  it('rejects an XI that is not eleven players', () => {
    const lineup = bestXI(squad, '4-4-2')
    expect(() => startersOf(squad, { ...lineup, starters: lineup.starters.slice(0, 10) })).toThrow(
      /11 players/,
    )
  })

  it('rejects two goalkeepers', () => {
    const keepers = squad.filter((p) => p.position === 'GK')
    const outfield = squad.filter((p) => p.position !== 'GK').slice(0, 9)
    const starters = [...keepers.slice(0, 2), ...outfield].map((p) => p.id)
    expect(() => startersOf(squad, { formation: '4-4-2', starters })).toThrow(/one goalkeeper/)
  })

  it('rejects the same player named twice', () => {
    // Duplicating an outfielder, not the keeper — duplicating the keeper trips the
    // one-goalkeeper rule first, which is the more useful message in that case.
    const lineup = bestXI(squad, '4-4-2')
    const duplicated = [...lineup.starters.slice(0, 10), lineup.starters[1] as PlayerId]
    expect(() => startersOf(squad, { ...lineup, starters: duplicated })).toThrow(/twice/)
  })

  it('rejects a player from another squad', () => {
    const lineup = bestXI(squad, '4-4-2')
    const foreign = ['stranger' as PlayerId, ...lineup.starters.slice(1)]
    expect(() => startersOf(squad, { ...lineup, starters: foreign })).toThrow(/not in this squad/)
  })
})

describe('bestXI', () => {
  it('picks the right shape for the formation', () => {
    for (const formation of FORMATION_NAMES) {
      const starters = startersOf(squad, bestXI(squad, formation))
      const shape = FORMATIONS[formation]
      for (const position of ['GK', 'DF', 'MF', 'FW'] as const) {
        expect(starters.filter((p) => p.position === position)).toHaveLength(shape[position])
      }
    }
  })

  it('throws when the squad cannot fill the formation', () => {
    const noForwards = squad.filter((p) => p.position !== 'FW')
    expect(() => bestXI(noForwards, '4-4-2')).toThrow(/formation needs/)
  })
})
