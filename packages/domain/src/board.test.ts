import { describe, expect, it } from 'vitest'
import type { ClubId } from './entities.ts'
import { judge, openingBoard, standingOf, STRIKES_ALLOWED, targetFor } from './board.ts'
import { reduce } from './reduce.ts'
import { createRng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import { computeTable } from './table.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The board: a target, a warning, and the sack.
 *
 * The claims here are about the *rules* — what the board asks for and when it
 * acts. They are deliberately deterministic; nothing about the board depends on
 * a match result being any particular way.
 */

const CLUBS = TEST_CLUBS.length
const BEST = TEST_CLUBS[0]
const WORST = TEST_CLUBS[19]
if (BEST === undefined || WORST === undefined) throw new Error('no clubs')

describe('what the board asks for', () => {
  it('ranks a club by its squad, not by last season', () => {
    expect(standingOf(BEST.id, TEST_CLUBS)).toBe(1)
    expect(standingOf(WORST.id, TEST_CLUBS)).toBe(CLUBS)
  })

  it('falls back to mid-table for a club it does not know', () => {
    expect(standingOf('nowhere' as ClubId, TEST_CLUBS)).toBe(Math.ceil(CLUBS / 2))
  })

  it('asks more of a better club', () => {
    expect(targetFor(BEST.id, TEST_CLUBS, null)).toBeLessThan(targetFor(WORST.id, TEST_CLUBS, null))
  })

  it('never demands better than winning it', () => {
    // The best club's standing is already 1, and the slack would push the target
    // to −1 without a clamp.
    expect(targetFor(BEST.id, TEST_CLUBS, 1)).toBe(1)
  })

  it('never asks a club to go down', () => {
    // Without a floor the weakest club's target drifts into the relegation
    // places, which is a board asking you to be relegated.
    for (const club of TEST_CLUBS) {
      for (const finish of [null, 1, 10, CLUBS]) {
        expect(targetFor(club.id, TEST_CLUBS, finish), club.id).toBeLessThanOrEqual(CLUBS - 3)
      }
    }
  })

  it('tightens after a good season and loosens after a bad one', () => {
    // The self-correction that keeps a career from spiralling: a target that only
    // ever tightened would eventually be impossible, and the strike count is what
    // is supposed to end a job.
    const mid = TEST_CLUBS[9]
    /* c8 ignore next */
    if (mid === undefined) throw new Error('no club')

    const afterGood = targetFor(mid.id, TEST_CLUBS, 2)
    const afterBad = targetFor(mid.id, TEST_CLUBS, 18)
    expect(afterGood).toBeLessThan(afterBad)
  })
})

describe('the verdict', () => {
  const board = openingBoard(WORST.id, TEST_CLUBS)

  it('is satisfied by hitting the target exactly', () => {
    expect(judge(board, board.target, WORST.id, TEST_CLUBS).met).toBe(true)
  })

  it('counts a miss', () => {
    const verdict = judge(board, board.target + 1, WORST.id, TEST_CLUBS)
    expect(verdict.met).toBe(false)
    expect(verdict.board.strikes).toBe(1)
    expect(verdict.dismissed).toBe(false)
  })

  it('warns before it acts', () => {
    // The whole point of two strikes. One bad season is a bad season.
    const first = judge(board, CLUBS, WORST.id, TEST_CLUBS)
    expect(first.dismissed).toBe(false)

    const second = judge(first.board, CLUBS, WORST.id, TEST_CLUBS)
    expect(second.dismissed).toBe(true)
    expect(second.board.sacked).toBe(true)
    expect(second.board.strikes).toBe(STRIKES_ALLOWED)
  })

  it('clears the slate when you deliver', () => {
    // Strikes are consecutive, which is what makes a warning a warning rather
    // than a countdown you can never escape.
    const missed = judge(board, CLUBS, WORST.id, TEST_CLUBS)
    expect(missed.board.strikes).toBe(1)

    const met = judge(missed.board, 1, WORST.id, TEST_CLUBS)
    expect(met.board.strikes).toBe(0)
    expect(met.board.sacked).toBe(false)
  })
})

describe('the board through the reducer', () => {
  const play = () => {
    const rng = createRng(20260815)
    const state = newSeason(TEST_CLUBS, 2026, {
      names: TEST_NAMES,
      rng,
      managedClubId: WORST.id,
    })
    return { finished: simulateSeason(state, rng), rng }
  }

  it('judges on the day the season ends, not when you press on', () => {
    // The verdict has to be visible *before* the summer, or a dismissal is
    // something you discover by clicking "start next season".
    const rng = createRng(20260815)
    let state = newSeason(TEST_CLUBS, 2026, {
      names: TEST_NAMES,
      rng,
      managedClubId: WORST.id,
    })

    let verdict
    for (let day = 0; day < 400 && verdict === undefined; day++) {
      const result = reduce(state, { type: 'AdvanceDay' }, rng)
      state = result.state
      verdict = result.events.find((e) => e.type === 'BoardVerdict')
    }

    /* c8 ignore next */
    if (verdict === undefined) throw new Error('no verdict in a whole season')
    const table = computeTable(state.competition.clubIds, state.season.fixtures)
    expect(verdict.finish).toBe(table.findIndex((row) => row.clubId === WORST.id) + 1)
    expect(verdict.target).toBe(openingBoard(WORST.id, TEST_CLUBS).target)
  })

  it('says it once: there is no day after the last one to say it again', () => {
    // Same discipline as `SeasonEnded`: emitted on the transition, and the clock
    // refuses to tick past it.
    const { finished, rng } = play()
    expect(() => reduce(finished, { type: 'AdvanceDay' }, rng)).toThrow(/season is over/)
  })

  it('carries the target into the next season', () => {
    const { finished, rng } = play()
    const next = reduce(finished, { type: 'StartNewSeason', names: TEST_NAMES }, rng).state
    expect(next.board.target).toBeGreaterThan(0)
    expect(next.board.target).toBeLessThanOrEqual(CLUBS - 3)
  })
})
