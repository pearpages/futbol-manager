import { describe, expect, it } from 'vitest'
import type { ClubId, Fixture, FixtureId } from './entities.ts'
import type { DayNumber } from './time.ts'
import {
  type ArchivedSeason,
  championOf,
  finalTableOf,
  finishOf,
  honoursFor,
  titlesByClub,
} from './history.ts'
import { computeTable } from './table.ts'
import { createRng } from './rng.ts'
import { rolloverSeason } from './season.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The archive, and the palmarés derived from it.
 *
 * Most of this file works on hand-built four-club seasons rather than on a real
 * one, because a palmarés is about *who came first* and a synthetic league can be
 * made to have a champion by construction. The rollover tests at the foot use the
 * real thing, because what they check is that the archive is written at all.
 */

const SEED = 20260817

/** A season of one round among four clubs, with the scores given. */
function seasonOf(
  startYear: number,
  scores: readonly (readonly [string, string, number, number])[],
  managedClubId = 'a',
): ArchivedSeason {
  return {
    startYear,
    clubIds: ['a', 'b', 'c', 'd'] as ClubId[],
    fixtures: scores.map(([home, away, hs, as_], index) => ({
      id: `r1-${home}-${away}` as FixtureId,
      round: 1,
      // A date is a branded integer day count; these seasons never read it.
      date: index as unknown as DayNumber,
      homeId: home as ClubId,
      awayId: away as ClubId,
      result: { home: hs, away: as_ },
    })),
    managedClubId: managedClubId as ClubId,
  }
}

/** The same four clubs with nothing played — a career resumed mid-summer. */
function unplayed(startYear: number): ArchivedSeason {
  return {
    startYear,
    clubIds: ['a', 'b', 'c', 'd'] as ClubId[],
    fixtures: [
      {
        id: 'r1-a-b' as FixtureId,
        round: 1,
        date: 0 as unknown as DayNumber,
        homeId: 'a' as ClubId,
        awayId: 'b' as ClubId,
        result: null,
      } satisfies Fixture,
    ],
    managedClubId: 'a' as ClubId,
  }
}

/** `a` wins, `b` second, `c` third, `d` last. */
const A_WINS = seasonOf(2026, [
  ['a', 'b', 3, 0],
  ['a', 'c', 2, 0],
  ['a', 'd', 1, 0],
  ['b', 'c', 2, 0],
  ['b', 'd', 1, 0],
  ['c', 'd', 1, 0],
])

/** `b` wins, `a` second — the mirror image, so a test cannot pass on `a` being first anyway. */
const B_WINS = seasonOf(2027, [
  ['b', 'a', 3, 0],
  ['b', 'c', 2, 0],
  ['b', 'd', 1, 0],
  ['a', 'c', 2, 0],
  ['a', 'd', 1, 0],
  ['c', 'd', 1, 0],
])

describe('finalTableOf', () => {
  it('is the classification of the archived fixtures', () => {
    // Derived, never stored — so it must agree with `computeTable` exactly.
    expect(finalTableOf(A_WINS)).toEqual(computeTable(A_WINS.clubIds, A_WINS.fixtures))
  })

  it('ranks the archived season rather than any live one', () => {
    expect(finalTableOf(A_WINS).map((row) => row.clubId)).toEqual(['a', 'b', 'c', 'd'])
    expect(finalTableOf(B_WINS).map((row) => row.clubId)).toEqual(['b', 'a', 'c', 'd'])
  })
})

describe('championOf', () => {
  it('names the club that finished first', () => {
    expect(championOf(A_WINS)).toBe('a')
    expect(championOf(B_WINS)).toBe('b')
  })

  it('names nobody for a season in which nothing was played', () => {
    // Not a guard: a career resumed mid-summer rolls over an empty season, and a
    // champion of nothing is a lie the palmarés would then repeat forever.
    expect(championOf(unplayed(2026))).toBeNull()
  })
})

describe('finishOf', () => {
  it('is the club position, 1-based', () => {
    expect(finishOf(A_WINS, 'a' as ClubId)).toBe(1)
    expect(finishOf(A_WINS, 'd' as ClubId)).toBe(4)
  })

  it('is null for a club that was not in that division', () => {
    expect(finishOf(A_WINS, 'z' as ClubId)).toBeNull()
  })

  it('is null when nothing was played', () => {
    expect(finishOf(unplayed(2026), 'a' as ClubId)).toBeNull()
  })
})

describe('titlesByClub', () => {
  it('collects the years each club won', () => {
    const roll = titlesByClub([A_WINS, B_WINS, seasonOf(2028, A_WINS.fixtures.map(toScore))])
    expect(roll).toEqual([
      { clubId: 'a', years: [2026, 2028] },
      { clubId: 'b', years: [2027] },
    ])
  })

  it('counts champions, not the club being managed', () => {
    // `b` wins both while `a` is the managed club throughout — reading
    // `managedClubId` instead of the table would credit the wrong club entirely.
    const roll = titlesByClub([B_WINS, seasonOf(2028, B_WINS.fixtures.map(toScore), 'a')])
    expect(roll.map((entry) => entry.clubId)).toEqual(['b'])
    expect(roll[0]?.years).toEqual([2027, 2028])
  })

  it('puts the most decorated club first', () => {
    const roll = titlesByClub([A_WINS, B_WINS, seasonOf(2028, B_WINS.fixtures.map(toScore))])
    expect(roll.map((entry) => entry.clubId)).toEqual(['b', 'a'])
  })

  it('skips a season nobody won', () => {
    expect(titlesByClub([unplayed(2026)])).toEqual([])
    expect(titlesByClub([])).toEqual([])
  })
})

describe('honoursFor', () => {
  it('separates titles from runner-up finishes', () => {
    const honours = honoursFor([A_WINS, B_WINS], 'a' as ClubId)
    expect(honours.titles).toEqual([2026])
    expect(honours.runnerUp).toEqual([2027])
    expect(honours.best).toBe(1)
    expect(honours.seasons).toBe(2)
  })

  it('reports a best finish for a club that has never won', () => {
    const honours = honoursFor([A_WINS, B_WINS], 'c' as ClubId)
    expect(honours.titles).toEqual([])
    expect(honours.best).toBe(3)
    expect(honours.seasons).toBe(2)
  })

  it('has no best finish before a season has been completed', () => {
    expect(honoursFor([], 'a' as ClubId)).toEqual({
      titles: [],
      runnerUp: [],
      best: null,
      seasons: 0,
    })
  })
})

/** Re-reads a fixture list as the tuple `seasonOf` takes, so a season can be replayed. */
function toScore(fixture: Fixture): readonly [string, string, number, number] {
  return [fixture.homeId, fixture.awayId, fixture.result?.home ?? 0, fixture.result?.away ?? 0]
}

describe('the rollover writes the archive', () => {
  const fresh = (): GameState =>
    newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng: createRng(SEED) })

  /** A season played to the last fixture, then rolled into the next. */
  function playAndRoll(state: GameState): GameState {
    const played = simulateSeason(state, createRng(SEED))
    return rolloverSeason(played, createRng(SEED), { names: TEST_NAMES })
  }

  it('starts a career with no past', () => {
    expect(fresh().history).toEqual([])
  })

  it('archives the season it just closed', () => {
    const rolled = playAndRoll(fresh())

    expect(rolled.history).toHaveLength(1)
    const archived = rolled.history[0]
    expect(archived?.startYear).toBe(2026)
    expect(archived?.managedClubId).toBe(rolled.managedClubId)
    expect(archived?.clubIds).toEqual(rolled.competition.clubIds)
    // Every result kept, and the new season's fixtures are not them.
    expect(archived?.fixtures).toHaveLength(380)
    expect(archived?.fixtures.every((f) => f.result !== null)).toBe(true)
    expect(rolled.season.fixtures.every((f) => f.result === null)).toBe(true)
  })

  it('archives the champion the table actually names', () => {
    const played = simulateSeason(fresh(), createRng(SEED))
    const expected = computeTable(played.competition.clubIds, played.season.fixtures)[0]?.clubId
    const rolled = rolloverSeason(played, createRng(SEED), { names: TEST_NAMES })

    expect(expected).toBeDefined()
    expect(championOf(rolled.history[0] as ArchivedSeason)).toBe(expected)
  })

  it('accumulates oldest first across a career', () => {
    const two = playAndRoll(playAndRoll(fresh()))

    expect(two.history.map((season) => season.startYear)).toEqual([2026, 2027])
  })

  it('archives nothing for a season with no results', () => {
    // `settleSeason` awards no prize money in this case either — the two agree
    // deliberately, because both describe a season that never happened.
    const rolled = rolloverSeason(fresh(), createRng(SEED), { names: TEST_NAMES })

    expect(rolled.history).toEqual([])
  })
})
