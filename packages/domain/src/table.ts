import type { ClubId, Fixture } from './entities.ts'

/**
 * League table with the Spanish tiebreaker chain. See docs/adr/0003-league-format.md.
 *
 *   points → head-to-head points → head-to-head goal difference
 *          → overall goal difference → goals for → club id
 *
 * Two rules make this more than a comparator, and both are real RFEF behaviour
 * rather than embellishment:
 *
 * 1. **Head-to-head applies only when every match among the tied clubs has been
 *    played.** Mid-season it is skipped entirely and the chain falls through to
 *    goal difference. Without this, a table rendered in October ranks clubs on a
 *    half-played mini-league, which looks like a bug to a player and is one.
 *
 * 2. **It is recursive.** If three clubs are tied and the mini-table separates one
 *    of them, the remaining two are re-compared on *their* head-to-head, not on
 *    the three-way numbers.
 *
 * The final fallback is club id — deliberately not the PRNG. A table must not
 * reshuffle between two renders of the same state.
 */

const WIN_POINTS = 3
const DRAW_POINTS = 1

export interface TableRow {
  readonly clubId: ClubId
  readonly played: number
  readonly won: number
  readonly drawn: number
  readonly lost: number
  readonly goalsFor: number
  readonly goalsAgainst: number
  readonly goalDifference: number
  readonly points: number
}

interface Tally {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
}

function emptyTally(): Tally {
  return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
}

function record(tally: Tally, scored: number, conceded: number): void {
  tally.played++
  tally.goalsFor += scored
  tally.goalsAgainst += conceded
  if (scored > conceded) tally.won++
  else if (scored === conceded) tally.drawn++
  else tally.lost++
}

/** Accumulates played fixtures into per-club tallies. Unplayed fixtures are ignored. */
function tally(clubIds: readonly ClubId[], fixtures: readonly Fixture[]): Map<ClubId, Tally> {
  const tallies = new Map<ClubId, Tally>(clubIds.map((id) => [id, emptyTally()]))

  for (const fixture of fixtures) {
    if (fixture.result === null) continue
    const home = tallies.get(fixture.homeId)
    const away = tallies.get(fixture.awayId)
    if (home === undefined || away === undefined) continue // club outside this table
    record(home, fixture.result.home, fixture.result.away)
    record(away, fixture.result.away, fixture.result.home)
  }

  return tallies
}

function toRow(clubId: ClubId, t: Tally): TableRow {
  return {
    clubId,
    played: t.played,
    won: t.won,
    drawn: t.drawn,
    lost: t.lost,
    goalsFor: t.goalsFor,
    goalsAgainst: t.goalsAgainst,
    goalDifference: t.goalsFor - t.goalsAgainst,
    points: t.won * WIN_POINTS + t.drawn * DRAW_POINTS,
  }
}

/** Ranked table, best first. */
export function computeTable(clubIds: readonly ClubId[], fixtures: readonly Fixture[]): TableRow[] {
  const rows = [...tally(clubIds, fixtures)].map(([id, t]) => toRow(id, t))

  // Points first, then resolve each tied block on its own terms.
  const byPoints = groupBy(
    [...rows].sort((a, b) => b.points - a.points),
    (r) => r.points,
  )
  return byPoints.flatMap((block) => orderTiedBlock(block, fixtures))
}

/**
 * Orders clubs level on points. Recursive: a mini-table that separates part of the
 * block re-runs on each remaining sub-block, so a three-way tie broken into 1 + 2
 * compares the surviving pair head-to-head rather than on three-way numbers.
 *
 * Terminates because recursion happens only when the block genuinely splits, and
 * sub-blocks are strictly smaller.
 */
function orderTiedBlock(block: readonly TableRow[], fixtures: readonly Fixture[]): TableRow[] {
  if (block.length === 1) return [...block]

  const ids = block.map((r) => r.clubId)

  if (allMeetingsPlayed(ids, fixtures)) {
    const mini = new Map(
      [...tally(ids, meetingsAmong(ids, fixtures))].map(([id, t]) => [id, toRow(id, t)]),
    )

    const sorted = [...block].sort((a, b) => {
      const ma = mini.get(a.clubId)
      const mb = mini.get(b.clubId)
      /* c8 ignore next */
      if (ma === undefined || mb === undefined) return 0
      return mb.points - ma.points || mb.goalDifference - ma.goalDifference
    })

    const subBlocks = groupBy(sorted, (r) => {
      const m = mini.get(r.clubId)
      /* c8 ignore next */
      if (m === undefined) return 'x'
      return `${m.points}:${m.goalDifference}`
    })

    // Only recurse if head-to-head actually separated somebody; otherwise fall
    // through to the overall criteria below rather than looping forever.
    if (subBlocks.length > 1) {
      return subBlocks.flatMap((sub) => orderTiedBlock(sub, fixtures))
    }
  }

  return [...block].sort(byOverallCriteria)
}

function byOverallCriteria(a: TableRow, b: TableRow): number {
  return (
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.clubId.localeCompare(b.clubId)
  )
}

/** Fixtures in which both clubs belong to the group. */
function meetingsAmong(ids: readonly ClubId[], fixtures: readonly Fixture[]): Fixture[] {
  const inGroup = new Set(ids)
  return fixtures.filter((f) => inGroup.has(f.homeId) && inGroup.has(f.awayId))
}

/**
 * True when every ordered pair in the group has met — both legs, since this is a
 * double round-robin. Anything less and head-to-head is not yet meaningful.
 */
function allMeetingsPlayed(ids: readonly ClubId[], fixtures: readonly Fixture[]): boolean {
  const played = new Set(
    meetingsAmong(ids, fixtures)
      .filter((f) => f.result !== null)
      .map((f) => `${f.homeId}v${f.awayId}`),
  )

  for (const home of ids) {
    for (const away of ids) {
      if (home !== away && !played.has(`${home}v${away}`)) return false
    }
  }
  return true
}

/** Splits an already-sorted list into runs of equal key, preserving order. */
function groupBy<T, K>(sorted: readonly T[], key: (item: T) => K): T[][] {
  const groups: T[][] = []
  let current: T[] = []
  let currentKey: K | undefined

  for (const item of sorted) {
    const k = key(item)
    if (current.length === 0 || k === currentKey) {
      current.push(item)
    } else {
      groups.push(current)
      current = [item]
    }
    currentKey = k
  }

  if (current.length > 0) groups.push(current)
  return groups
}
