import { describe, expect, it } from 'vitest'
import { bestXI } from './lineup.ts'
import { aiSaleRefusal, loseCost, MIN_SQUAD, reluctancePremium, surplus } from './market.ts'
import { overall, type Player } from './player.ts'
import { createRng } from './rng.ts'
import { newSeason } from './simulate.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The seller's side of a bid: what a club refuses outright, and what it charges
 * for a player it would rather keep.
 *
 * The reducer's use of these is driven in `market.human.test.ts`. This file is
 * about the functions themselves, over the whole test league rather than one
 * constructed squad — the inertness claim below is only worth anything if it
 * holds for every club at once.
 */

const state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng: createRng(4242) })
const squadOf = (index: number): readonly Player[] =>
  state.squads[TEST_CLUBS[index]?.id ?? ''] ?? []

describe('reluctancePremium', () => {
  it('is exactly 1 for every player the AI would have sold anyway', () => {
    // **The property the whole phase rests on.** Every calibrated band in the
    // project is measured through paths that only ever touch `surplus` players,
    // so a premium that is 1 across all of them cannot move any of them — the
    // same argument M3c's `tempo` makes at balanced tactics.
    let checked = 0
    for (const club of TEST_CLUBS) {
      const squad = state.squads[club.id] ?? []
      for (const player of surplus(squad)) {
        expect(reluctancePremium(squad, player), `${club.id} ${player.name}`).toBe(1)
        checked++
      }
    }
    // Guard on the guard: an empty loop would satisfy the assertion perfectly.
    expect(checked).toBeGreaterThan(100)
  })

  it('charges for a player his club picked, even when it has cover behind him', () => {
    // **The case `loseCost` alone gets wrong**, and the reason the second term
    // exists. On the shipped league Madrid's 90-rated forward scores zero — there
    // is another 90 on the bench, so the XI genuinely does not get worse — which
    // priced him at his bare €6.4M and let a €5.3M club buy him.
    //
    // Constructed rather than found: `TEST_CLUBS` generates squads on a smooth
    // depth curve, so no starter anywhere in the test league has an equal behind
    // him. That is the harness measuring generated squads while the game ships
    // real ones, and here it means the interesting case has to be built.
    const squad = squadOf(0)
    const starter = squad.find((p) => bestXI(squad, '4-4-2').starters.includes(p.id))
    /* c8 ignore next */
    if (starter === undefined) throw new Error('nobody is picked')
    const understudy = squad.find((p) => p.position === starter.position && p.id !== starter.id)
    /* c8 ignore next */
    if (understudy === undefined) throw new Error('no understudy')

    const covered = squad.map((p) =>
      p.id === understudy.id ? { ...p, attributes: starter.attributes } : p,
    )

    expect(loseCost(covered, starter)).toBe(0)
    expect(reluctancePremium(covered, starter)).toBeGreaterThan(1.4)
  })

  it('charges more for a club’s first-choice goalkeeper than for its third', () => {
    // A keeper carries 35% of the defensive rating alone and no club carries real
    // depth there, so this is the largest premium in the game and the one most
    // worth pinning.
    const squad = squadOf(0)
    const keepers = squad.filter((p) => p.position === 'GK').sort((a, b) => overall(b) - overall(a))
    const best = keepers[0]
    const last = keepers.at(-1)
    /* c8 ignore next */
    if (best === undefined || last === undefined || best.id === last.id)
      throw new Error('no keepers')

    expect(reluctancePremium(squad, best)).toBeGreaterThan(reluctancePremium(squad, last))
  })

  it('never charges more than the cap', () => {
    for (const club of TEST_CLUBS) {
      const squad = state.squads[club.id] ?? []
      for (const player of squad) expect(reluctancePremium(squad, player)).toBeLessThanOrEqual(6)
    }
  })
})

describe('loseCost', () => {
  it('is zero for anyone outside the best XI', () => {
    const squad = squadOf(5)
    const picked = new Set(bestXI(squad, '4-4-2').starters)
    for (const player of squad.filter((p) => !picked.has(p.id))) {
      expect(loseCost(squad, player), player.name).toBe(0)
    }
  })

  // **The clamp is asserted in `packages/data/src/rosters.test.ts`, not here**, and
  // that is not laziness. `bestXI` picks by `overall` while `teamRatingRaw` weights
  // attributes, so adding a player back can pick a different-but-equal side and
  // score a rounding-sized negative — which happens on the shipped rosters and not
  // once in this generated league. A version of that test lived here, passed, and
  // was found to prove nothing by mutating the clamp away: nothing failed.
})

describe('aiSaleRefusal', () => {
  it('lets a full squad sell anybody, including its best player', () => {
    const squad = squadOf(0)
    const best = [...squad].sort((a, b) => overall(b) - overall(a))[0]
    /* c8 ignore next */
    if (best === undefined) throw new Error('no squad')
    expect(aiSaleRefusal(squad, best)).toBeNull()
  })

  it('refuses everything at the squad floor', () => {
    const squad = squadOf(0).slice(0, MIN_SQUAD)
    for (const player of squad) expect(aiSaleRefusal(squad, player)).toBe('squadFloor')
  })

  it('refuses the last player a formation needs at his position', () => {
    // A squad well above the floor but down to the depth limit at one position,
    // so only the shape clause can be answering.
    const full = squadOf(0)
    const keeper = full.find((p) => p.position === 'GK')
    /* c8 ignore next */
    if (keeper === undefined) throw new Error('no keeper')
    const squad = [keeper, ...full.filter((p) => p.position !== 'GK')]

    expect(squad.length).toBeGreaterThan(MIN_SQUAD)
    expect(aiSaleRefusal(squad, keeper)).toBe('shape')
  })
})
