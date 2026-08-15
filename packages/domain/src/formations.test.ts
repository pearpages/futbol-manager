import { describe, expect, it } from 'vitest'
import {
  bestXI,
  canField,
  DEEPEST_BANK,
  fieldableFormation,
  FORMATION_NAMES,
  FORMATIONS,
  startersOf,
  teamRatingRaw,
} from './lineup.ts'
import { applyTransfers } from './market.ts'
import type { ClubId } from './entities.ts'
import type { Player, Position } from './player.ts'
import { POSITIONS } from './player.ts'
import { createRng } from './rng.ts'
import { rolloverSeason } from './season.ts'
import { newSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The second batch of formations, and the crash they would otherwise have caused.
 *
 * `bestXI` throws when a squad is short at any bank. That is correct for a broken
 * squad and wrong for a club that merely sold a striker, and until 4-2-4 existed
 * no shape asked for more than three forwards so it never came up.
 */

const SEED = 20260815

function freshState(): GameState {
  return newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng: createRng(SEED) })
}

const countOf = (squad: readonly Player[], position: Position) =>
  squad.filter((p) => p.position === position).length

/** Trims a club's squad to exactly `keep` players at one position. */
function trimTo(state: GameState, clubId: ClubId, position: Position, keep: number): GameState {
  const squad = state.squads[clubId] ?? []
  const atPosition = squad.filter((p) => p.position === position)
  const dropped = new Set(atPosition.slice(keep).map((p) => p.id))
  return {
    ...state,
    squads: { ...state.squads, [clubId]: squad.filter((p) => !dropped.has(p.id)) },
  }
}

describe('canField', () => {
  const squad = freshState().squads[TEST_CLUBS[0]?.id ?? ('c01' as ClubId)] ?? []

  it('accepts a full squad in every shape', () => {
    for (const formation of FORMATION_NAMES) {
      expect(canField(squad, formation), formation).toBe(true)
    }
  })

  it('rejects a shape the squad is one player short of', () => {
    // 4-2-4 is the only shape wanting a fourth forward, so a squad with three can
    // still field everything else. That asymmetry is the whole point of the check.
    const thin = squad.filter(
      (p) => p.position !== 'FW' || squad.filter((q) => q.position === 'FW').indexOf(p) < 3,
    )
    expect(countOf(thin, 'FW')).toBe(3)
    expect(canField(thin, '4-2-4')).toBe(false)
    expect(canField(thin, '4-4-2')).toBe(true)
    expect(canField(thin, '4-3-3')).toBe(true)
  })

  it('agrees with bestXI about what is possible', () => {
    // The guard on the guard: canField exists to predict bestXI, so a squad it
    // accepts must actually build, and one it rejects must actually throw.
    for (let fw = 1; fw <= 5; fw++) {
      const thin = trimTo(freshState(), TEST_CLUBS[0]?.id ?? ('c01' as ClubId), 'FW', fw)
      const trimmed = thin.squads[TEST_CLUBS[0]?.id ?? ('c01' as ClubId)] ?? []
      for (const formation of FORMATION_NAMES) {
        if (canField(trimmed, formation)) {
          expect(() => bestXI(trimmed, formation), `${formation} fw=${fw}`).not.toThrow()
        } else {
          expect(() => bestXI(trimmed, formation), `${formation} fw=${fw}`).toThrow()
        }
      }
    }
  })
})

describe('fieldableFormation', () => {
  const clubId = TEST_CLUBS[0]?.id ?? ('c01' as ClubId)

  it('keeps the preferred shape when it is playable', () => {
    const squad = freshState().squads[clubId] ?? []
    expect(fieldableFormation(squad, '4-2-4')).toBe('4-2-4')
  })

  it('falls back to the default when it is not', () => {
    const thin = trimTo(freshState(), clubId, 'FW', 3).squads[clubId] ?? []
    expect(fieldableFormation(thin, '4-2-4')).toBe('4-4-2')
  })
})

describe('a sale cannot crash the reducer', () => {
  const clubId = TEST_CLUBS[0]?.id ?? ('c01' as ClubId)
  const buyerId = TEST_CLUBS[1]?.id ?? ('c02' as ClubId)

  /** A club playing 4-2-4 with exactly the four forwards it needs, selling one. */
  function sellAForward(): GameState {
    let state = trimTo(freshState(), clubId, 'FW', 4)
    const squad = state.squads[clubId] ?? []
    state = { ...state, lineups: { ...state.lineups, [clubId]: bestXI(squad, '4-2-4') } }

    const sold = squad.find((p) => p.position === 'FW')
    /* c8 ignore next */
    if (sold === undefined) throw new Error('no forward')

    return applyTransfers(state, [{ playerId: sold.id, from: clubId, to: buyerId, fee: 1000 }])
  }

  it('does not throw when the squad drops below its shape', () => {
    // Without `fieldableFormation` this is `Squad has 3 FW, formation needs 4`,
    // raised inside `applyTransfers` — which runs inside `dispatch`, and the app
    // has no error boundary to catch it.
    expect(() => sellAForward()).not.toThrow()
  })

  it('drops the club back to a shape it can field', () => {
    const after = sellAForward()
    expect(after.lineups[clubId]?.formation).toBe('4-4-2')
    expect(countOf(after.squads[clubId] ?? [], 'FW')).toBe(3)
  })

  it('leaves a club that can still field its shape alone', () => {
    // The fallback must not quietly reset everybody's formation.
    let state = trimTo(freshState(), clubId, 'FW', 5)
    const squad = state.squads[clubId] ?? []
    state = { ...state, lineups: { ...state.lineups, [clubId]: bestXI(squad, '4-2-4') } }
    const sold = squad.find((p) => p.position === 'FW')
    /* c8 ignore next */
    if (sold === undefined) throw new Error('no forward')

    const after = applyTransfers(state, [
      { playerId: sold.id, from: clubId, to: buyerId, fee: 1000 },
    ])
    expect(after.lineups[clubId]?.formation).toBe('4-2-4')
  })
})

describe('a rollover cannot crash the reducer', () => {
  const clubId = TEST_CLUBS[0]?.id ?? ('c01' as ClubId)

  /**
   * A club stored on 4-2-4 whose squad already holds only three forwards.
   *
   * `rolloverSeason` cannot *create* this on its own — releases are floored by
   * `canRelease` and a retirement promotes a youth at the same position, so a bank
   * never drops there. It arrives from outside, which today means a sale (guarded
   * in `applyTransfers`) and from M6 will mean an injury or a suspension. So this
   * guard is defence in depth rather than a live crash, and the test builds the
   * state directly rather than pretending a rollover produced it.
   */
  function alreadyShort(): GameState {
    const state = trimTo(freshState(), clubId, 'FW', 4)
    const full = state.squads[clubId] ?? []
    const lineup = bestXI(full, '4-2-4')
    const dropped = full.find((p) => p.position === 'FW')
    /* c8 ignore next */
    if (dropped === undefined) throw new Error('no forward')

    return {
      ...state,
      squads: { ...state.squads, [clubId]: full.filter((p) => p.id !== dropped.id) },
      lineups: { ...state.lineups, [clubId]: lineup },
    }
  }

  it('survives a squad already below its stored shape', () => {
    expect(countOf(alreadyShort().squads[clubId] ?? [], 'FW')).toBe(3)
    expect(() =>
      rolloverSeason(alreadyShort(), createRng(SEED), { names: TEST_NAMES }),
    ).not.toThrow()
  })

  it('brings that club back to a shape it can field', () => {
    const after = rolloverSeason(alreadyShort(), createRng(SEED), { names: TEST_NAMES })
    const squad = after.squads[clubId] ?? []
    const formation = after.lineups[clubId]?.formation
    /* c8 ignore next */
    if (formation === undefined) throw new Error('no lineup')
    expect(canField(squad, formation)).toBe(true)
  })
})

describe('the release and sale floors cover every shape', () => {
  it('derives the deepest bank rather than asserting it', () => {
    // The bug this replaced: `canSpare` hand-wrote `4-4-2 + 1` and claimed it
    // satisfied every other formation. True until 4-2-4 wanted a fourth forward.
    for (const position of POSITIONS) {
      const deepest = Math.max(
        ...FORMATION_NAMES.map((name) => (FORMATIONS[name] as Record<Position, number>)[position]),
      )
      expect(DEEPEST_BANK[position], position).toBe(deepest)
    }
  })

  it('asks for four forwards, which is what 4-2-4 added', () => {
    expect(DEEPEST_BANK.FW).toBe(4)
  })
})

describe('formation tempo', () => {
  const squad = freshState().squads[TEST_CLUBS[0]?.id ?? ('c01' as ClubId)] ?? []
  const tempoOf = (formation: (typeof FORMATION_NAMES)[number]) =>
    teamRatingRaw(startersOf(squad, bestXI(squad, formation))).tempo

  it('is exactly zero in the default shape', () => {
    // The property the whole change rests on: every calibrated band and
    // `pnpm season` run in 4-4-2, so a non-zero value here moves all of them.
    expect(tempoOf('4-4-2')).toBe(0)
  })

  it('opens the game up for attacking shapes and smothers it for defensive ones', () => {
    expect(tempoOf('4-2-4')).toBeGreaterThan(0)
    expect(tempoOf('3-4-3')).toBeGreaterThan(0)
    expect(tempoOf('5-4-1')).toBeLessThan(0)
    expect(tempoOf('4-5-1')).toBeLessThan(0)
  })

  it('never out-swings the slider', () => {
    // The slider spans -1..+1 and stays the primary tempo control. A shape able to
    // exceed it would make the slider the decoration instead.
    for (const formation of FORMATION_NAMES) {
      expect(Math.abs(tempoOf(formation)), formation).toBeLessThan(1)
    }
  })

  it('reads the shape off the pitch, not off the label', () => {
    // The lineup's `formation` field is never checked against its own banks — see
    // `setLineup` — so a mislabelled XI is possible. Tempo follows the players.
    const asFourTwoFour = bestXI(squad, '4-2-4')
    const mislabelled = { ...asFourTwoFour, formation: '4-4-2' as const }
    expect(teamRatingRaw(startersOf(squad, mislabelled)).tempo).toBe(tempoOf('4-2-4'))
  })
})
