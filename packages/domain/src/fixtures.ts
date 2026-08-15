import type { ClubId, Fixture, FixtureId } from './entities.ts'
import { addDays, type DayNumber } from './time.ts'

/**
 * Round-robin fixture generation. Written for one 20-club league, not an arbitrary
 * N — ground rule 5. The generalisation arrives at M7 with the second division.
 */

export const CLUB_COUNT = 20
export const ROUNDS_PER_HALF = CLUB_COUNT - 1 // 19
export const TOTAL_ROUNDS = ROUNDS_PER_HALF * 2 // 38
export const FIXTURES_PER_ROUND = CLUB_COUNT / 2 // 10

const DAYS_PER_ROUND = 7

/**
 * Circle method: club 0 stays put while the other 19 rotate around it. Each
 * rotation yields one round of 10 fixtures in which every club appears exactly
 * once.
 *
 * Venue assignment keys off a club's **own carousel index**, which advances by one
 * each round and therefore alternates parity — so a club alternates home and away.
 * Since 19 is odd, indices `i` and `19 - i` always have opposite parity, so "home
 * is whoever sits at an even index" picks exactly one club of each pairing.
 *
 * Two details make this non-obvious and are worth stating, because both were bugs
 * on the way here:
 *
 * - Keying off `(round + pairing)` looks equivalent and is not. A club's index
 *   grows with the round, so the two terms cancel and the parity never changes —
 *   producing 19 consecutive home games.
 * - Index 0 is the fixed club and never rotates, so its parity is constant. Its
 *   pairing alone falls back to round parity.
 *
 * No round-robin schedule alternates perfectly; this is balanced 19/19 with only
 * short streaks, which the tests pin down.
 *
 * The second half mirrors the first with venues swapped, as the Spanish league
 * does.
 */
export function generateFixtures(clubIds: readonly ClubId[], seasonStart: DayNumber): Fixture[] {
  if (clubIds.length !== CLUB_COUNT) {
    throw new Error(`Expected ${CLUB_COUNT} clubs, got ${clubIds.length}`)
  }

  const fixtures: Fixture[] = []
  // Rotating carousel: index 0 is fixed, 1..19 rotate.
  const carousel = [...clubIds]

  for (let round = 0; round < ROUNDS_PER_HALF; round++) {
    for (let pairing = 0; pairing < FIXTURES_PER_ROUND; pairing++) {
      const first = carousel[pairing]
      const second = carousel[CLUB_COUNT - 1 - pairing]
      /* c8 ignore next */
      if (first === undefined || second === undefined) throw new Error('carousel desync')

      // `first` sits at index `pairing`, `second` at index `19 - pairing` —
      // always opposite parity. The fixed club at index 0 never rotates, so its
      // pairing uses round parity instead.
      const firstIsHome = pairing === 0 ? round % 2 === 0 : pairing % 2 === 0
      const homeId = firstIsHome ? first : second
      const awayId = firstIsHome ? second : first

      fixtures.push(makeFixture(round, homeId, awayId, seasonStart))
      // Reverse leg: same pairing, venues swapped, 19 rounds later.
      fixtures.push(makeFixture(round + ROUNDS_PER_HALF, awayId, homeId, seasonStart))
    }

    rotate(carousel)
  }

  return fixtures.sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))
}

function makeFixture(
  roundIndex: number,
  homeId: ClubId,
  awayId: ClubId,
  seasonStart: DayNumber,
): Fixture {
  return {
    id: `r${roundIndex + 1}-${homeId}-${awayId}` as FixtureId,
    round: roundIndex + 1,
    date: addDays(seasonStart, roundIndex * DAYS_PER_ROUND),
    homeId,
    awayId,
    result: null,
  }
}

/** Rotates positions 1..19, leaving index 0 fixed. */
function rotate(carousel: ClubId[]): void {
  const last = carousel.pop()
  /* c8 ignore next */
  if (last === undefined) throw new Error('carousel empty')
  carousel.splice(1, 0, last)
}

/** Every fixture scheduled for exactly this day. */
export function fixturesOn(fixtures: readonly Fixture[], date: DayNumber): Fixture[] {
  return fixtures.filter((f) => f.date === date)
}

/**
 * The next fixture a club has to play, or `null` once its season is done.
 *
 * Deliberately takes no "from" date. `advanceDay` resolves everything *due*, so a
 * fixture the clock has already passed is still owed and is still the next one to
 * be played — filtering on `date >= today` would hide it and tell a manager his
 * next match is next week when it is overdue today.
 */
export function nextFixtureFor(fixtures: readonly Fixture[], clubId: ClubId): Fixture | null {
  let next: Fixture | null = null

  for (const fixture of fixtures) {
    if (fixture.result !== null) continue
    if (fixture.homeId !== clubId && fixture.awayId !== clubId) continue
    if (next === null || fixture.date < next.date) next = fixture
  }

  return next
}

export type Outcome = 'win' | 'draw' | 'loss'

/** A played fixture from one club's point of view. */
export interface ClubResult {
  readonly fixtureId: FixtureId
  readonly opponentId: ClubId
  readonly home: boolean
  readonly ours: number
  readonly theirs: number
  readonly outcome: Outcome
}

/**
 * A club's last `count` results, **oldest first** — form-guide order, so the most
 * recent match is the last element.
 *
 * The mirror image of {@link nextFixtureFor}: that one drops played fixtures and takes
 * the earliest, this one keeps them and takes the latest few.
 *
 * **The perspective flip is the whole risk here.** An away 0–2 is a win, so `ours` and
 * `theirs` swap on `home` — reading them straight off the score inverts every away
 * result and still looks plausible. `table.ts` does the same flip by argument order and
 * keeps its version private; that file feeds every calibrated band in the project, so
 * it is deliberately left alone rather than refactored to share this.
 */
export function recentResultsFor(
  fixtures: readonly Fixture[],
  clubId: ClubId,
  count: number,
): ClubResult[] {
  return fixtures
    .filter((f) => f.result !== null && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => a.date - b.date)
    .slice(-count)
    .map((fixture) => {
      const home = fixture.homeId === clubId
      /* c8 ignore next */
      if (fixture.result === null) throw new Error('unplayed fixture survived the filter')
      const ours = home ? fixture.result.home : fixture.result.away
      const theirs = home ? fixture.result.away : fixture.result.home

      return {
        fixtureId: fixture.id,
        opponentId: home ? fixture.awayId : fixture.homeId,
        home,
        ours,
        theirs,
        outcome: ours > theirs ? 'win' : ours < theirs ? 'loss' : 'draw',
      }
    })
}
