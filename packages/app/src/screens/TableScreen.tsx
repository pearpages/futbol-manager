import { useState } from 'react'
import { computeTable, type TableRow } from '@fm/domain'
import { type Band, BANDS, bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { matchdayFor } from '../matchday.ts'
import {
  ClubCell,
  DataTable,
  Screen,
  ScreenHeading,
  ScreenNote,
  type Sort,
  sortedBy,
  SortHeader,
  Stat,
  StatLabel,
  StatValue,
  Swatch,
  VisuallyHidden,
} from '@fm/design-system'
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
  // The round about to be played, as the hub names it, so "Matchday" means one
  // thing on every screen. Once the season is over, its last round.
  const round =
    matchdayFor(game)?.fixture.round ?? Math.max(1, ...game.season.fixtures.map((f) => f.round))

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
  function column(key: SortKey, label: string, fullLabel?: string) {
    return (
      <SortHeader
        column={key}
        label={label}
        {...(fullLabel === undefined ? {} : { fullLabel })}
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
      <Screen className="table-screen__main">
        <ScreenHeading>{game.competition.name}</ScreenHeading>
        <DataTable>
          <thead className="data-table__head">
            <tr>
              <th>
                <VisuallyHidden>{t('table.qualification')}</VisuallyHidden>
              </th>
              {/* Not sortable, deliberately: the unsorted order *is* position order,
                  so the control's ascending state would be its own home state. */}
              <th>
                <span aria-hidden="true">{t('table.column.position')}</span>
                <VisuallyHidden>{t('column.full.position')}</VisuallyHidden>
              </th>
              {column('club', t('table.column.club'))}
              {column('played', t('table.column.played'), t('column.full.played'))}
              {column('won', t('table.column.won'), t('column.full.won'))}
              {column('drawn', t('table.column.drawn'), t('column.full.drawn'))}
              {column('lost', t('table.column.lost'), t('column.full.lost'))}
              {column('goalsFor', t('table.column.goalsFor'), t('column.full.goalsFor'))}
              {column(
                'goalsAgainst',
                t('table.column.goalsAgainst'),
                t('column.full.goalsAgainst'),
              )}
              {column(
                'goalDifference',
                t('table.column.goalDifference'),
                t('column.full.goalDifference'),
              )}
              {column('points', t('table.column.points'), t('column.full.points'))}
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
                    {band !== null && <VisuallyHidden>{t(band.label)}</VisuallyHidden>}
                  </td>
                  <td className="data-table__num">{position}</td>
                  <td className="is-text">
                    <ClubCell>
                      {club !== undefined && <ClubBadge club={club} />}
                      {club?.name ?? row.clubId}
                    </ClubCell>
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
        </DataTable>

        {/* Built from BANDS, so a band can never be shown without being explained. */}
        <ul className="table-legend">
          {BANDS.map((band) => (
            <li key={band.className} className="table-legend__item">
              <Swatch className={`${band.className}`} />
              {t(band.label)}
            </li>
          ))}
        </ul>
      </Screen>

      <aside className="table-screen__side">
        <Screen className="table-screen__meta">
          <div className="table-screen__stats">
            <Stat>
              <StatLabel>{t('table.matchday')}</StatLabel>
              <StatValue>{round}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('table.date')}</StatLabel>
              <StatValue className="table-screen__date">{date(game.season.currentDate)}</StatValue>
            </Stat>
          </div>
        </Screen>

        <Screen className="table-screen__results">
          <ScreenHeading>{t('table.latestResults')}</ScreenHeading>
          {results.length === 0 ? (
            <ScreenNote>{t('table.noResults')}</ScreenNote>
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
        </Screen>
      </aside>
    </div>
  )
}
