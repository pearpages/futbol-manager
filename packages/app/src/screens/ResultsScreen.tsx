import { useMemo, useState } from 'react'
import {
  type ArchivedSeason,
  type Club,
  type ClubId,
  computeTable,
  finalTableOf,
  finishOf,
  honoursFor,
  titlesByClub,
} from '@fm/domain'
import { bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { Pager, TrophyIcon } from '@fm/design-system'
import { artSrc, TROPHY_KEYS } from './art.ts'
import './ResultsScreen.css'

/**
 * Results, and what a career has won.
 *
 * **This screen exists because the hub had two tiles pointing at one.**
 * Clasificació and Resultats both carried `to: 'table'`, so half of Seguiment was
 * a dead press — and the only results the game ever showed were the ten most
 * recent in `TableScreen`'s aside, read off the event feed, which is capped at 60
 * and cleared on load.
 *
 * ## The cross-table, and which way round it goes
 *
 * Rows are **home** clubs, columns **away** clubs, so cell (row, column) is
 * `result.home – result.away` read straight off the fixture with no perspective
 * flip anywhere. That is correct *by construction*, and it is also the one thing
 * here that could be wrong while looking entirely plausible: transpose the axes
 * and every score in the grid is reversed, which no reader would catch and no
 * arithmetic would contradict. `recentResultsFor`'s comment is a monument to the
 * same hazard; there is a test that fails if the axes swap.
 *
 * Both axes are in **classification order** — the final table for a past season,
 * the live one for this season — so the grid reads like a table rather than
 * alphabetically, and the champion's row is the top row.
 *
 * ## Any season, not just this one
 *
 * The archive keeps every fixture of every finished season (`domain/history.ts`),
 * which is what the season picker spends. That was the whole argument for storing
 * results rather than only champions: a palmarés that lists years tells you who
 * won, and this tells you how.
 *
 * ## Why the matchday tab is the one that opens
 *
 * **The cross-table was the only view, and it is the wrong instrument for the
 * question a manager asks most.** Reported after one match had been played: the
 * result was nowhere to be found. It was there — the grid, the classification and
 * the calendar all agreed — but it was *ten 11px scores scattered across 390 blank
 * cells*, and a played cell differed from an empty one only by being a little
 * lighter. The grid is built for a finished season, where 380 of its cells carry
 * something; at matchday 1 the signal is 2.5% of the field.
 *
 * So a matchday tab leads, showing one round as ten readable lines, and the grid
 * keeps its own tab for the season-shaped question it is actually good at. Both
 * read the same `Viewing`, so both work for an archived season too.
 */

type Tab = 'round' | 'grid' | 'palmares'

/** The live season, or one out of the archive. Both answer the same questions. */
interface Viewing {
  readonly startYear: number
  readonly clubIds: readonly ClubId[]
  readonly fixtures: ArchivedSeason['fixtures']
  /** Best first. */
  readonly order: readonly ClubId[]
}

export function ResultsScreen() {
  const game = useGame((s) => s.game)
  const { t, plural, date, season, count } = useT()

  const [tab, setTab] = useState<Tab>('round')
  /** `null` is the season being played. */
  const [year, setYear] = useState<number | null>(null)
  /**
   * Which matchday the round tab is showing, or `null` for "the latest one with a
   * result in it".
   *
   * `null` rather than a number so the default *follows the season* — it has to
   * mean "latest" rather than a round chosen when the component mounted, or the
   * view would stop moving with the clock and would show matchday 1 of a season
   * picked out of the archive.
   */
  const [round, setRound] = useState<number | null>(null)

  const clubs = useMemo(() => new Map(game.clubs.map((c) => [c.id, c])), [game.clubs])

  /**
   * Newest first, the live season at the head — the order a picker should offer,
   * since the season you are playing is the one you almost always want.
   */
  const seasons = useMemo(
    () => [
      { year: null as number | null, label: game.season.startYear },
      ...[...game.history].reverse().map((a) => ({ year: a.startYear, label: a.startYear })),
    ],
    [game.history, game.season.startYear],
  )

  const viewing: Viewing | null = useMemo(() => {
    if (year === null) {
      const order = computeTable(game.competition.clubIds, game.season.fixtures).map(
        (row) => row.clubId,
      )
      return {
        startYear: game.season.startYear,
        clubIds: game.competition.clubIds,
        fixtures: game.season.fixtures,
        order,
      }
    }
    const archived = game.history.find((a) => a.startYear === year)
    if (archived === undefined) return null
    return {
      startYear: archived.startYear,
      clubIds: archived.clubIds,
      fixtures: archived.fixtures,
      order: finalTableOf(archived).map((row) => row.clubId),
    }
  }, [year, game.history, game.competition.clubIds, game.season])

  return (
    <div className="results-screen">
      <section className="screen results-screen__main">
        <div className="results-screen__bar">
          {/*
            Two buttons with `aria-pressed`, not a `role="tablist"`. A tablist owes
            arrow-key navigation to be honest about the role, and the app has
            exactly one piece of hand-rolled keyboard handling (`Modal`, whose
            focus trap turned out to have three edges rather than two). Two buttons
            owe nothing and are keyboard-reachable for free.
          */}
          <div className="results-screen__tabs">
            {(['round', 'grid', 'palmares'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`button${tab === key ? ' is-primary' : ''}`}
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key)
                }}
              >
                {t(`results.tab.${key}`)}
              </button>
            ))}
          </div>

          {/* A season control for the two tabs that show *one* season. The Palmarés
              lists every season at once, so a selector there would appear to do
              nothing — measured on the built app, where it sat on all of them.
              Changing season drops the chosen matchday back to "latest", since
              round 30 of a season that reached round 4 is not a view of anything. */}
          {tab !== 'palmares' && seasons.length > 1 && (
            <label className="results-screen__season">
              <span className="results-screen__season-label">{t('results.season')}</span>
              <select
                className="select"
                value={year ?? ''}
                onChange={(e) => {
                  setYear(e.target.value === '' ? null : Number(e.target.value))
                  setRound(null)
                }}
              >
                {seasons.map((entry) => (
                  <option key={entry.year ?? 'live'} value={entry.year ?? ''}>
                    {season(entry.label)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {tab === 'palmares' ? (
          <SeasonHistory history={game.history} clubs={clubs} managed={game.managedClubId} />
        ) : viewing === null ? (
          <p className="screen__note">{t('results.noSeason')}</p>
        ) : tab === 'round' ? (
          <RoundResults
            viewing={viewing}
            clubs={clubs}
            managed={game.managedClubId}
            round={round}
            onRound={setRound}
          />
        ) : (
          <ResultGrid viewing={viewing} clubs={clubs} managed={game.managedClubId} />
        )}
      </section>

      <aside className="results-screen__side">
        <section className="screen results-screen__panel">
          <h2 className="screen__heading">{t('palmares.yours')}</h2>
          <Honours history={game.history} clubId={game.managedClubId} />
        </section>

        <section className="screen results-screen__panel">
          <h2 className="screen__heading">{t('palmares.league')}</h2>
          <RollOfHonour history={game.history} clubs={clubs} managed={game.managedClubId} />
        </section>

        <section className="screen results-screen__panel">
          <div className="results-screen__vitals">
            <div className="stat">
              <span className="stat__label">{t('table.date')}</span>
              <span className="stat__value results-screen__date">
                {date(game.season.currentDate)}
              </span>
            </div>
            <p className="hint">
              {plural('results.archived', game.history.length, {
                count: count(game.history.length),
              })}
            </p>
          </div>
        </section>
      </aside>
    </div>
  )
}

/**
 * One matchday, as ten lines you can actually read.
 *
 * The answer to "I played a match and cannot see the result". Ten rows beats ten
 * cells in a four-hundred-cell grid, and it is how a results page has always been
 * read: a round, its date, and the fixtures under it.
 *
 * **The rounds are walked, not assumed to be 1..38.** `TOTAL_ROUNDS` would be the
 * obvious bound and it would be an assumption about a fixture set this component
 * does not generate — an archived season, or M7's second division, need not match.
 * The first and last round present in `viewing.fixtures` are the bounds.
 */
function RoundResults({
  viewing,
  clubs,
  managed,
  round,
  onRound,
}: {
  readonly viewing: Viewing
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly managed: ClubId
  readonly round: number | null
  readonly onRound: (round: number) => void
}) {
  const { t, date } = useT()

  const rounds = useMemo(() => {
    let first: number | null = null
    let last: number | null = null
    /** The furthest round with a result in it — where a manager wants to land. */
    let latestPlayed: number | null = null
    for (const fixture of viewing.fixtures) {
      if (first === null || fixture.round < first) first = fixture.round
      if (last === null || fixture.round > last) last = fixture.round
      if (fixture.result !== null && (latestPlayed === null || fixture.round > latestPlayed)) {
        latestPlayed = fixture.round
      }
    }
    return { first, last, latestPlayed }
  }, [viewing.fixtures])

  /** Position in the classification, so the rows read in the grid's row order. */
  const rank = useMemo(() => new Map(viewing.order.map((id, i) => [id, i])), [viewing.order])

  if (rounds.first === null || rounds.last === null) {
    return <p className="screen__note">{t('results.noSeason')}</p>
  }

  // Nothing played yet is a real state on day one, and matchday 1 is the right
  // thing to show then — a fixture list rather than an empty screen.
  const showing = Math.min(
    Math.max(round ?? rounds.latestPlayed ?? rounds.first, rounds.first),
    rounds.last,
  )

  const fixtures = viewing.fixtures
    .filter((f) => f.round === showing)
    .toSorted((a, b) => (rank.get(a.homeId) ?? 0) - (rank.get(b.homeId) ?? 0))

  const when = fixtures[0]?.date ?? null

  return (
    <>
      <Pager
        className="results-screen__rounds"
        prevLabel={t('results.prevRound')}
        nextLabel={t('results.nextRound')}
        atStart={showing <= rounds.first}
        atEnd={showing >= rounds.last}
        onPrev={() => {
          onRound(showing - 1)
        }}
        onNext={() => {
          onRound(showing + 1)
        }}
      >
        {/* The date is a *sibling* of the heading, not inside it. Nothing in the DOM
            separates two spans, so a date within the `<h2>` makes its accessible
            name `Matchday 12026-08-15` — the fifth instance of a defect this
            project has shipped four times (`CanteraM7`, `20Relegated`,
            `Temporada 1En joc`, and the calendar's own score cell). Caught here by
            a test resolving the heading by exact name. */}
        <div className="results-screen__round">
          <h2 className="results-screen__round-label">
            {t('results.roundLabel', { round: showing })}
          </h2>
          {when !== null && <span className="results-screen__round-date">{date(when)}</span>}
        </div>
      </Pager>

      <ul className="round-list">
        {fixtures.map((fixture) => {
          const home = clubs.get(fixture.homeId)
          const away = clubs.get(fixture.awayId)
          const yours = fixture.homeId === managed || fixture.awayId === managed
          const name = (id: ClubId) => clubs.get(id)?.name ?? id

          // One whole sentence per the i18n rule, and it doubles as what a screen
          // reader gets — the same shape the grid's cells and `FormStrip` use.
          const told =
            fixture.result === null
              ? t('results.unplayed', { home: name(fixture.homeId), away: name(fixture.awayId) })
              : t('results.cell', {
                  home: name(fixture.homeId),
                  away: name(fixture.awayId),
                  ours: fixture.result.home,
                  theirs: fixture.result.away,
                  round: fixture.round,
                })

          return (
            <li key={fixture.id} className={`round-list__item${yours ? ' is-you' : ''}`}>
              <span className="round-list__side is-home">
                <span className="round-list__club">{name(fixture.homeId)}</span>
                {home !== undefined && <ClubBadge club={home} />}
              </span>
              <span
                className={`round-list__score${fixture.result === null ? ' is-unplayed' : ''}`}
                title={told}
              >
                <span aria-hidden="true">
                  {fixture.result === null
                    ? '—'
                    : `${String(fixture.result.home)}–${String(fixture.result.away)}`}
                </span>
                <span className="visually-hidden">{told}</span>
              </span>
              <span className="round-list__side">
                {away !== undefined && <ClubBadge club={away} />}
                <span className="round-list__club">{name(fixture.awayId)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/**
 * The 20 × 20 cross-table.
 *
 * The lookup is a `Map` keyed `home|away` rather than a scan per cell: 400 cells
 * against 380 fixtures is 152,000 comparisons the naive version would do on every
 * render, and this screen re-renders on every tick of the day clock.
 */
function ResultGrid({
  viewing,
  clubs,
  managed,
}: {
  readonly viewing: Viewing
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly managed: ClubId
}) {
  const { t, season } = useT()

  const scores = useMemo(() => {
    const map = new Map<string, { home: number; away: number; round: number }>()
    for (const fixture of viewing.fixtures) {
      if (fixture.result === null) continue
      map.set(`${fixture.homeId}|${fixture.awayId}`, {
        home: fixture.result.home,
        away: fixture.result.away,
        round: fixture.round,
      })
    }
    return map
  }, [viewing.fixtures])

  const name = (id: ClubId) => clubs.get(id)?.name ?? id

  return (
    <>
      <h2 className="screen__heading">
        {t('results.gridHeading', { season: season(viewing.startYear) })}
      </h2>
      <p className="screen__note">{t('results.gridNote')}</p>

      {/* Its own scroll container, so the tabs and the picker above do not scroll
          away with it. `.screen` carries `overflow: auto`, which would otherwise
          take the whole panel. Never a silent column cap — this project has
          removed one of those already. */}
      <div className="results-grid__scroll">
        <table className="results-grid">
          <thead>
            <tr>
              <th className="results-grid__corner">
                <span className="visually-hidden">{t('results.homeAway')}</span>
              </th>
              {viewing.order.map((awayId) => {
                const club = clubs.get(awayId)
                return (
                  <th
                    key={awayId}
                    className={`results-grid__head${awayId === managed ? ' is-you' : ''}`}
                  >
                    {club !== undefined && <ClubBadge club={club} />}
                    <span className="visually-hidden">{name(awayId)}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {viewing.order.map((homeId) => {
              const club = clubs.get(homeId)
              return (
                <tr
                  key={homeId}
                  className={`results-grid__row${homeId === managed ? ' is-you' : ''}`}
                >
                  <th className="results-grid__side">
                    <span className="club-cell">
                      {club !== undefined && <ClubBadge club={club} />}
                      <span className="results-grid__club">{name(homeId)}</span>
                    </span>
                  </th>
                  {viewing.order.map((awayId) => {
                    if (homeId === awayId) {
                      return <td key={awayId} className="results-grid__self" aria-hidden="true" />
                    }
                    const score = scores.get(`${homeId}|${awayId}`)
                    if (score === undefined) {
                      return (
                        <td key={awayId} className="results-grid__cell is-unplayed">
                          <span className="visually-hidden">
                            {t('results.unplayed', {
                              home: name(homeId),
                              away: name(awayId),
                            })}
                          </span>
                        </td>
                      )
                    }
                    // One whole sentence, per the i18n rule — and it doubles as
                    // what a screen reader gets, the same shape `FormStrip` and
                    // the table's position bands use.
                    const told = t('results.cell', {
                      home: name(homeId),
                      away: name(awayId),
                      ours: score.home,
                      theirs: score.away,
                      round: score.round,
                    })
                    return (
                      <td
                        key={awayId}
                        className={`results-grid__cell ${outcomeClass(score)}`}
                        title={told}
                      >
                        <span aria-hidden="true">
                          {score.home}–{score.away}
                        </span>
                        <span className="visually-hidden">{told}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** From the home club's point of view, which is whose row it is. */
function outcomeClass(score: { home: number; away: number }): string {
  if (score.home > score.away) return 'is-home-win'
  if (score.home < score.away) return 'is-away-win'
  return 'is-draw'
}

/** Season by season: who won it, who came second, and where you finished. */
function SeasonHistory({
  history,
  clubs,
  managed,
}: {
  readonly history: readonly ArchivedSeason[]
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly managed: ClubId
}) {
  const { t, season } = useT()

  if (history.length === 0) {
    return (
      <>
        <h2 className="screen__heading">{t('palmares.history')}</h2>
        <p className="screen__note">{t('palmares.empty')}</p>
      </>
    )
  }

  return (
    <>
      <h2 className="screen__heading">{t('palmares.history')}</h2>
      <table className="data-table">
        <thead className="data-table__head">
          <tr>
            <th className="is-text">{t('palmares.column.season')}</th>
            <th className="is-text">{t('palmares.column.champion')}</th>
            <th className="is-text">{t('palmares.column.runnerUp')}</th>
            <th>{t('table.column.points')}</th>
            <th>{t('palmares.column.you')}</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((archived) => {
            const table = finalTableOf(archived)
            const champion = table[0]
            const second = table[1]
            const yours = finishOf(archived, managed)
            const band = yours === null ? null : bandFor(yours, table.length)
            return (
              <tr key={archived.startYear} className="data-table__row">
                <td className="is-text">{season(archived.startYear)}</td>
                <td className="is-text">
                  <ClubCell clubs={clubs} id={champion?.clubId} />
                </td>
                <td className="is-text">
                  <ClubCell clubs={clubs} id={second?.clubId} />
                </td>
                <td>{champion?.points ?? '—'}</td>
                <td className="data-table__num">
                  <span className="results-screen__finish">
                    {yours ?? '—'}
                    {/* `.swatch` rather than the band class on this cell: the band
                        classes only paint under `.data-table__band` and `.swatch`,
                        so the class alone was silently inert here. */}
                    {band !== null && (
                      <>
                        <span className={`swatch ${band.className}`} />
                        <span className="visually-hidden"> {t(band.label)}</span>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function ClubCell({
  clubs,
  id,
}: {
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly id: ClubId | undefined
}) {
  if (id === undefined) return <>—</>
  const club = clubs.get(id)
  return (
    <span className="club-cell">
      {club !== undefined && <ClubBadge club={club} />}
      {club?.name ?? id}
    </span>
  )
}

/**
 * Your club's honours, one row per competition.
 *
 * A competition you have never won is shown dimmed rather than hidden, so the
 * shape of what is winnable is visible from the first day of a career — the same
 * idea as the hub showing its unbuilt tiles. It is also what makes the cup and the
 * supercup additive: two more rows, not a new panel.
 */
function Honours({
  history,
  clubId,
}: {
  readonly history: readonly ArchivedSeason[]
  readonly clubId: ClubId
}) {
  const { t, plural, season } = useT()
  const honours = honoursFor(history, clubId)

  return (
    <ul className="honours">
      {TROPHY_KEYS.map((trophy) => {
        // One competition today, so the league's titles are this club's titles.
        // A second trophy reads its own count here.
        const years = honours.titles
        const won = years.length > 0
        return (
          <li key={trophy} className={`honours__item${won ? '' : ' is-empty'}`}>
            <TrophyIcon trophy={trophy} src={artSrc(trophy)} empty={!won} />
            <div className="honours__text">
              <span className="honours__name">{t(`palmares.competition.${trophy}`)}</span>
              <span className="honours__count">
                {won
                  ? plural('palmares.won', years.length, { count: years.length })
                  : t('palmares.neverWon')}
              </span>
              {won && (
                <span className="honours__years">{years.map((y) => season(y)).join(' · ')}</span>
              )}
            </div>
          </li>
        )
      })}
      <li className="honours__aside">
        {honours.best === null
          ? t('palmares.noSeasons')
          : t('palmares.best', { position: honours.best })}
        {' · '}
        {plural('palmares.seasons', honours.seasons, { count: honours.seasons })}
      </li>
    </ul>
  )
}

/** Every club that has won the league, most decorated first. */
function RollOfHonour({
  history,
  clubs,
  managed,
}: {
  readonly history: readonly ArchivedSeason[]
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly managed: ClubId
}) {
  const { t, season } = useT()
  const roll = titlesByClub(history)

  if (roll.length === 0) return <p className="screen__note">{t('palmares.noChampions')}</p>

  return (
    <ul className="roll">
      {roll.map(({ clubId, years }) => (
        <li key={clubId} className={`roll__item${clubId === managed ? ' is-you' : ''}`}>
          <ClubCell clubs={clubs} id={clubId} />
          <span className="roll__count">{years.length}</span>
          <span className="roll__years">{years.map((y) => season(y)).join(' · ')}</span>
        </li>
      ))}
    </ul>
  )
}
