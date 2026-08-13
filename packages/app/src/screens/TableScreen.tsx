import { computeTable, formatDate } from '@fm/domain'
import { useGame } from '../store.ts'
import './TableScreen.css'

/**
 * The classification. Position bands on the left edge are how a Spanish table is
 * actually read — champion, Europe, and the drop — so they carry information
 * rather than decorate.
 */
function bandFor(position: number, total: number): string {
  if (position === 1) return 'is-champion'
  if (position <= 4) return 'is-europe'
  if (position === 6) return 'is-conference'
  if (position > total - 3) return 'is-relegation'
  return ''
}

export function TableScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)

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
              return (
                <tr key={row.clubId} className={`data-table__row${isYou ? ' is-you' : ''}`}>
                  <td className={`data-table__band ${bandFor(index + 1, table.length)}`} />
                  <td className="data-table__num">{index + 1}</td>
                  <td className="is-text">{club?.name ?? row.clubId}</td>
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
      </aside>
    </div>
  )
}
