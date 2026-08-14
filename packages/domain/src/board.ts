import type { Club, ClubId } from './entities.ts'

/**
 * The board, and whether it still wants you.
 *
 * Until M5b a career had no end: you rolled from season to season forever and
 * nothing ever judged the result. A target the board sets, notices you missed and
 * eventually fires you for is what turns a sequence of seasons into a job.
 *
 * **The board judges league position and nothing else.** One number, one verdict,
 * and the season's story stays about football. The cost of that choice is worth
 * stating out loud rather than discovering later: **the overdraft M5a built still
 * has no teeth**, because nothing here punishes debt. A club can run to its limit
 * and the board will not mention it.
 *
 * Everything in this file is deterministic. It runs on the `SeasonEnded`
 * transition inside `AdvanceDay`, which is the path every calibrated band in the
 * project is measured through, so it must never draw randomness — the same rule
 * `finance.ts` and `bids.ts` live under.
 */

/** Miss the target this many seasons running and the board acts. */
export const STRIKES_ALLOWED = 2

/**
 * How much better than its own standing a club is expected to do.
 *
 * Zero would mean "finish exactly where your squad says you should", which is
 * both harsh and dull — a mid-table club would be sacked for finishing
 * mid-table. Two places of slack makes the target something you can hit by not
 * making a mess of it, and beat by doing the job well.
 */
const SLACK = 2

/** Nobody is asked to do better than win it. */
const BEST_TARGET = 1

/**
 * Nor worse than survive.
 *
 * Without a floor the target for the weakest club drifts below the relegation
 * places, which would be a board asking you to go down.
 */
const WORST_TARGET_FROM_BOTTOM = 3

export interface Board {
  /** The league position the club must reach, 1-based. */
  readonly target: number
  /** Seasons missed in a row. `STRIKES_ALLOWED` of them ends the job. */
  readonly strikes: number
  /** Set once the board has acted. A sacked manager's career is over. */
  readonly sacked: boolean
}

/**
 * Where a club sits in the league by squad strength, 1-based.
 *
 * Rating rather than last season's table, because the table is the thing being
 * judged — targeting a club at its own finishing position would make every
 * season a pass.
 */
export function standingOf(clubId: ClubId, clubs: readonly Club[]): number {
  const ranked = [...clubs].sort((a, b) => b.attack + b.defence - (a.attack + a.defence))
  const index = ranked.findIndex((club) => club.id === clubId)
  return index < 0 ? Math.ceil(clubs.length / 2) : index + 1
}

/**
 * What the board asks for next season.
 *
 * The club's own standing, blended with what it actually did last time. That
 * blend is what stops the target being static: **overachieve and it tightens,
 * have a bad season and it loosens.** The self-correction is deliberate — a
 * target that only ever tightened would eventually be impossible, and a career
 * should end because of the strike count rather than because the arithmetic ran
 * away.
 *
 * `lastFinish` is `null` in the first season of a career, where there is nothing
 * to blend and the standing is the whole answer.
 */
export function targetFor(
  clubId: ClubId,
  clubs: readonly Club[],
  lastFinish: number | null,
): number {
  const standing = standingOf(clubId, clubs)
  const basis = lastFinish === null ? standing : (standing + lastFinish) / 2
  const floor = clubs.length - WORST_TARGET_FROM_BOTTOM

  return Math.min(floor, Math.max(BEST_TARGET, Math.round(basis) - SLACK))
}

/** A brand-new career, before a ball has been kicked. */
export function openingBoard(clubId: ClubId, clubs: readonly Club[]): Board {
  return { target: targetFor(clubId, clubs, null), strikes: 0, sacked: false }
}

export interface Verdict {
  readonly board: Board
  readonly met: boolean
  /** True on the season that ends the job. */
  readonly dismissed: boolean
}

/**
 * The board's judgement on a finished season, and the target for the next one.
 *
 * A strike is only kept while they run consecutively: meeting the target clears
 * the slate, which is what makes the warning a warning rather than a countdown.
 */
export function judge(
  board: Board,
  finish: number,
  clubId: ClubId,
  clubs: readonly Club[],
): Verdict {
  const met = finish <= board.target
  const strikes = met ? 0 : board.strikes + 1
  const dismissed = strikes >= STRIKES_ALLOWED

  return {
    board: {
      target: targetFor(clubId, clubs, finish),
      strikes,
      sacked: dismissed,
    },
    met,
    dismissed,
  }
}
