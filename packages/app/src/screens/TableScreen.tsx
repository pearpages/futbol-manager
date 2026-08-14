import { computeTable, formatDate } from '@fm/domain'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import './TableScreen.css'

/**
 * Qualification bands — how a Spanish classification is actually read.
 *
 * Stated as a table rather than an `if` chain, because as a chain it was wrong:
 * fifth place fell through every branch and rendered with no colour at all. A
 * list of ranges can be read against a real table at a glance, and the test walks
 * all twenty positions against it.
 *
 * `from`/`to` count from the top; negative numbers count from the bottom, so the
 * relegation zone does not need the league size hardcoded.
 *
 * This lives in the UI rather than `domain` on purpose. Which positions qualify
 * for what is arguably a competition rule and M5's prize money will want it — but
 * there is one hardcoded league today, and ground rule 5 says wait for the second
 * case. Move it when M7 brings real continental competitions.
 */
export interface Band {
  readonly className: string
  readonly label: string
  readonly from: number
  readonly to: number
}

export const BANDS: readonly Band[] = [
  { className: 'is-champion', label: 'Champion', from: 1, to: 1 },
  { className: 'is-ucl', label: 'Champions League', from: 2, to: 4 },
  { className: 'is-uel', label: 'Europa League', from: 5, to: 5 },
  { className: 'is-uecl', label: 'Conference League', from: 6, to: 6 },
  { className: 'is-relegation', label: 'Relegated', from: -3, to: -1 },
]

export function bandFor(position: number, total: number): Band | null {
  const fromBottom = position - total - 1 // 20th of 20 → −1
  return (
    BANDS.find(
      (band) =>
        (band.from > 0 && position >= band.from && position <= band.to) ||
        (band.from < 0 && fromBottom >= band.from && fromBottom <= band.to),
    ) ?? null
  )
}

export function TableScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const go = useGame((s) => s.go)

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
        <h2 className="screen__heading">Primera División</h2>
        <table className="data-table">
          <thead className="data-table__head">
            <tr>
              <th aria-label="Qualification" />
              <th>#</th>
              <th className="is-text">Club</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => {
              const club = names.get(row.clubId)
              const isYou = row.clubId === game.managedClubId
              const band = bandFor(index + 1, table.length)
              return (
                <tr key={row.clubId} className={`data-table__row${isYou ? ' is-you' : ''}`}>
                  <td className={`data-table__band ${band?.className ?? ''}`} title={band?.label}>
                    {/* The band is colour; this is what it says to a reader who
                        cannot use colour. Mid-table is genuinely nothing. */}
                    {band !== null && <span className="visually-hidden">{band.label}</span>}
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
              {band.label}
            </li>
          ))}
        </ul>
      </section>

      <aside className="table-screen__side">
        <section className="screen table-screen__meta">
          <div className="table-screen__stats">
            <div className="stat">
              <span className="stat__label">Matchday</span>
              <span className="stat__value">{round}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Date</span>
              <span className="stat__value table-screen__date">
                {formatDate(game.season.currentDate)}
              </span>
            </div>
          </div>
        </section>

        <section className="screen table-screen__results">
          <h2 className="screen__heading">Latest results</h2>
          {results.length === 0 ? (
            <p className="screen__note">Advance the day to play the next round.</p>
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
            Volver
          </button>
        </div>
      </aside>
    </div>
  )
}
