import type { ClubId, Fixture } from './entities.ts'
import { computeTable, type TableRow } from './table.ts'

/**
 * What a career remembers about the seasons it has already played.
 *
 * Until now it remembered nothing. `rolloverSeason` replaces `season.fixtures`
 * wholesale with a freshly generated, empty set, so pressing *start season* threw
 * away every result and every final position in the league — and `settleSeason`
 * computes those positions, takes the prize money off them and discards them in
 * the same breath. The only backward-looking field in the whole model was
 * `Club.lastLedger`, which is money.
 *
 * ## The final table is derived, never stored
 *
 * `computeTable` is fixture-set agnostic — it accepts any `Fixture[]` and ignores
 * clubs outside the ids it is given — so a stored table would be a second copy of
 * something already implied by the fixtures, and the only thing two copies can do
 * is disagree. Keeping the fixtures and deriving the table is both smaller and
 * impossible to get out of step.
 *
 * ## What it costs, stated rather than discovered
 *
 * A season is 380 fixtures, roughly 42 KB of compact JSON, against a save that is
 * about 159 KB today — so a decade of history is ~9× the current save and thirty
 * seasons is a megabyte-scale export. That is affordable (IndexedDB stores a
 * structured clone and its quota is a large fraction of free disk) and it is the
 * price of being able to open any past season's results rather than only its
 * winner.
 *
 * Nothing is copied to get there: the archive **retains** the fixture array the
 * rollover was about to drop, so there is no allocation cost, only retention.
 * `Fixture.id` is kept even though `round`/`homeId`/`awayId` imply it, because
 * dropping it would stop `ArchivedSeason.fixtures` being passable straight to
 * `computeTable` and `recentResultsFor` unchanged — and re-deriving a schedule
 * from a live generator is exactly the trap `migrations.ts` refuses.
 *
 * This module imports `entities.ts` and `table.ts` and nothing else. It must not
 * reach for `state.ts`, which imports *it* — the same shape `board.ts` and
 * `bids.ts` already have.
 */

/** A season that has been played out. */
export interface ArchivedSeason {
  /** e.g. 2026 for the 2026/27 season. */
  readonly startYear: number
  /**
   * The clubs that contested it, so the table can be recomputed exactly.
   *
   * Stored rather than read off the live competition because the division a save
   * is playing today is not necessarily the one it played in 2026 — and it
   * certainly will not be once M7 adds promotion.
   */
  readonly clubIds: readonly ClubId[]
  /** Every fixture, results included. The final table is derived from this. */
  readonly fixtures: readonly Fixture[]
  /** Who you were managing that year. */
  readonly managedClubId: ClubId
}

/** The final classification, best first. */
export function finalTableOf(archived: ArchivedSeason): TableRow[] {
  return computeTable(archived.clubIds, archived.fixtures)
}

/**
 * Who won it, or `null` for a season in which nothing was played.
 *
 * `null` is a real answer rather than a guard: a career resumed mid-summer rolls
 * over a season with no results in it, and naming a champion of nothing would be
 * a lie the palmarés then repeats forever.
 */
export function championOf(archived: ArchivedSeason): ClubId | null {
  if (!archived.fixtures.some((fixture) => fixture.result !== null)) return null
  return finalTableOf(archived)[0]?.clubId ?? null
}

/** Where a club finished, 1-based, or `null` if it was not in that division. */
export function finishOf(archived: ArchivedSeason, clubId: ClubId): number | null {
  if (!archived.fixtures.some((fixture) => fixture.result !== null)) return null
  const index = finalTableOf(archived).findIndex((row) => row.clubId === clubId)
  return index === -1 ? null : index + 1
}

/**
 * The league's roll of honour: every club that has won it, and in which years.
 *
 * Ordered most titles first, then by the most recent win, then by club id — the
 * last one deliberately, so two clubs level on everything do not swap places
 * between two renders of the same state. Same reasoning as `computeTable`'s final
 * tiebreaker.
 */
export function titlesByClub(
  history: readonly ArchivedSeason[],
): readonly { readonly clubId: ClubId; readonly years: readonly number[] }[] {
  const years = new Map<ClubId, number[]>()

  for (const archived of history) {
    const champion = championOf(archived)
    if (champion === null) continue
    const won = years.get(champion)
    if (won === undefined) years.set(champion, [archived.startYear])
    else won.push(archived.startYear)
  }

  return [...years]
    .map(([clubId, won]) => ({ clubId, years: [...won].sort((a, b) => a - b) }))
    .sort(
      (a, b) =>
        b.years.length - a.years.length ||
        (b.years.at(-1) ?? 0) - (a.years.at(-1) ?? 0) ||
        a.clubId.localeCompare(b.clubId),
    )
}

/** One club's record across every season the save has archived. */
export interface Honours {
  /** Years it won the league, earliest first. */
  readonly titles: readonly number[]
  /** Years it finished second. */
  readonly runnerUp: readonly number[]
  /** Its best finish, or `null` if it has never completed a season. */
  readonly best: number | null
  /** Seasons it has completed. */
  readonly seasons: number
}

export function honoursFor(history: readonly ArchivedSeason[], clubId: ClubId): Honours {
  const titles: number[] = []
  const runnerUp: number[] = []
  let best: number | null = null
  let seasons = 0

  for (const archived of history) {
    const finish = finishOf(archived, clubId)
    if (finish === null) continue
    seasons++
    if (finish === 1) titles.push(archived.startYear)
    if (finish === 2) runnerUp.push(archived.startYear)
    if (best === null || finish < best) best = finish
  }

  return { titles, runnerUp, best, seasons }
}
