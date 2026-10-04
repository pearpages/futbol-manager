import { useState } from 'react'
import { computeTable, type TableRow } from '@fm/domain'
import { type Band, BANDS, bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { type Sort, SortHeader, sortedBy } from '@fm/design-system'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import './TableScreen.css'

type SortKey =
  | 'club'
  | 'played'
  | 'won'
  | 'drawn'
  | 'lost'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'goalDifference'
  | 'points'

/** Text columns read left, numbers read right — the `data-table` convention. */
const SORT_ALIGN: Readonly<Partial<Record<SortKey, string>>> = { club: 'is-text' }

/**
 * A row with its league position and band already decided.
 *
 * This is what keeps the screen honest under a sort. Position and the qualification
 * band describe the **club**, not the row it happens to occupy — so they are settled
 * from the classification before anything is reordered. Read off the render index
 * instead, sorting by goals scored would show the league's top scorer sitting first
 * wearing the champion's colours, which is simply false.
 */
interface Standing {
  readonly row: TableRow
  readonly position: number
  readonly band: Band | null
}

export function TableScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const { t, date, locale } = useT()

  /** `null` is the classification itself — the order the league is actually in. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)

  const table = computeTable(game.competition.clubIds, game.season.fixtures)
  const names = new Map(game.clubs.map((c) => [c.id, c]))
  const played = game.season.fixtures.filter((f) => f.result !== null).length
  const round = Math.max(1, Math.ceil(played / 10))

  const standings: Standing[] = table.map((row, index) => ({
    row,
    position: index + 1,
    band: bandFor(index + 1, table.length),
  }))

  const shown = sortedBy(
    standings,
    sort,
    ({ row }, key) => (key === 'club' ? (names.get(row.clubId)?.name ?? row.clubId) : row[key]),
    locale,
  )

  /** The shared header, bound to this screen's sort state. */
  function column(key: SortKey, label: string) {
    return (
      <SortHeader
        column={key}
        label={label}
        sort={sort}
        onSort={setSort}
        align={SORT_ALIGN[key] ?? ''}
      />
    )
  }

  const results = feed
    .filter((e) => e.type === 'MatchPlayed')
    .slice(0, 10)
    .map((e) => ({
      id: e.fixtureId,
      home: names.get(e.homeId)?.shortName ?? '???',
      away: names.get(e.awayId)?.shortName ?? '???',
      score: `${e.score.home}–${e.score.away}`,
    }))

  return (
    <div className="table-screen">
      <section className="screen table-screen__main">
        <h2 className="screen__heading">{game.competition.name}</h2>
        <table className="data-table">
          <thead className="data-table__head">
            <tr>
              <th aria-label={t('table.qualification')} />
              {/* Not sortable, deliberately: the unsorted order *is* position order,
                  so the control's ascending state would be its own home state. */}
              <th>{t('table.column.position')}</th>
              {column('club', t('table.column.club'))}
              {column('played', t('table.column.played'))}
              {column('won', t('table.column.won'))}
              {column('drawn', t('table.column.drawn'))}
              {column('lost', t('table.column.lost'))}
              {column('goalsFor', t('table.column.goalsFor'))}
              {column('goalsAgainst', t('table.column.goalsAgainst'))}
              {column('goalDifference', t('table.column.goalDifference'))}
              {column('points', t('table.column.points'))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row, position, band }) => {
              const club = names.get(row.clubId)
              const isYou = row.clubId === game.managedClubId
              return (
                <tr key={row.clubId} className={`data-table__row${isYou ? ' is-you' : ''}`}>
                  <td
                    className={`data-table__band ${band?.className ?? ''}`}
                    title={band === null ? undefined : t(band.label)}
                  >
                    {/* The band is colour; this is what it says to a reader who
                        cannot use colour. Mid-table is genuinely nothing. */}
                    {band !== null && <span className="visually-hidden">{t(band.label)}</span>}
                  </td>
                  <td className="data-table__num">{position}</td>
                  <td className="is-text">
                    <span className="club-cell">
                      {club !== undefined && <ClubBadge club={club} />}
                      {club?.name ?? row.clubId}
                    </span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>{row.goalsFor}</td>
                  <td>{row.goalsAgainst}</td>
                  <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td>
                    <strong>{row.points}</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Built from BANDS, so a band can never be shown without being explained. */}
        <ul className="table-legend">
          {BANDS.map((band) => (
            <li key={band.className} className="table-legend__item">
              <span className={`swatch ${band.className}`} />
              {t(band.label)}
            </li>
          ))}
        </ul>
      </section>

      <aside className="table-screen__side">
        <section className="screen table-screen__meta">
          <div className="table-screen__stats">
            <div className="stat">
              <span className="stat__label">{t('table.matchday')}</span>
              <span className="stat__value">{round}</span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('table.date')}</span>
              <span className="stat__value table-screen__date">
                {date(game.season.currentDate)}
              </span>
            </div>
          </div>
        </section>

        <section className="screen table-screen__results">
          <h2 className="screen__heading">{t('table.latestResults')}</h2>
          {results.length === 0 ? (
            <p className="screen__note">{t('table.noResults')}</p>
          ) : (
            <ul className="result-list">
              {results.map((r) => (
                <li key={r.id} className="result-list__item">
                  <span className="result-list__club">{r.home}</span>
                  <span className="result-list__score">{r.score}</span>
                  <span className="result-list__club is-away">{r.away}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
