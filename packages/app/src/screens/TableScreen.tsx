import { computeTable } from '@fm/domain'
import { BANDS, bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import './TableScreen.css'

export function TableScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const go = useGame((s) => s.go)
  const { t, date } = useT()

  const table = computeTable(game.competition.clubIds, game.season.fixtures)
  const names = new Map(game.clubs.map((c) => [c.id, c]))
  const played = game.season.fixtures.filter((f) => f.result !== null).length
  const round = Math.max(1, Math.ceil(played / 10))

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
              <th>{t('table.column.position')}</th>
              <th className="is-text">{t('table.column.club')}</th>
              <th>{t('table.column.played')}</th>
              <th>{t('table.column.won')}</th>
              <th>{t('table.column.drawn')}</th>
              <th>{t('table.column.lost')}</th>
              <th>{t('table.column.goalsFor')}</th>
              <th>{t('table.column.goalsAgainst')}</th>
              <th>{t('table.column.goalDifference')}</th>
              <th>{t('table.column.points')}</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => {
              const club = names.get(row.clubId)
              const isYou = row.clubId === game.managedClubId
              const band = bandFor(index + 1, table.length)
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
                  <td className="data-table__num">{index + 1}</td>
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
        <div className="screen-actions">
          <button type="button" className="button" onClick={() => go('hub')}>
            {t('action.back')}
          </button>
        </div>
      </aside>
    </div>
  )
}
