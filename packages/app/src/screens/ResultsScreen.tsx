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
import { TROPHY_KEYS } from './trophies.ts'
import { TrophyIcon } from './TrophyIcon.tsx'
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
 */

type Tab = 'grid' | 'palmares'

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

  const [tab, setTab] = useState<Tab>('grid')
  /** `null` is the season being played. */
  const [year, setYear] = useState<number | null>(null)

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
            <button
              type="button"
              className={`button${tab === 'grid' ? ' is-primary' : ''}`}
              aria-pressed={tab === 'grid'}
              onClick={() => setTab('grid')}
            >
              {t('results.tab.grid')}
            </button>
            <button
              type="button"
              className={`button${tab === 'palmares' ? ' is-primary' : ''}`}
              aria-pressed={tab === 'palmares'}
              onClick={() => setTab('palmares')}
            >
              {t('results.tab.palmares')}
            </button>
          </div>

          {/* The grid's control, not the screen's: the Palmarés lists every season
              at once, so a season selector there would appear to do nothing.
              Measured on the built app, where it sat on both tabs. */}
          {tab === 'grid' && seasons.length > 1 && (
            <label className="results-screen__season">
              <span className="results-screen__season-label">{t('results.season')}</span>
              <select
                className="select"
                value={year ?? ''}
                onChange={(e) => setYear(e.target.value === '' ? null : Number(e.target.value))}
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

        {tab === 'grid' ? (
          viewing === null ? (
            <p className="screen__note">{t('results.noSeason')}</p>
          ) : (
            <ResultGrid viewing={viewing} clubs={clubs} managed={game.managedClubId} />
          )
        ) : (
          <SeasonHistory history={game.history} clubs={clubs} managed={game.managedClubId} />
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
            <TrophyIcon trophy={trophy} empty={!won} />
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
