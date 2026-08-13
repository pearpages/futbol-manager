import { ageOn, overall, type Player, type Position } from '@fm/domain'
import { useGame } from '../store.ts'
import './SquadScreen.css'

const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }

export function positionChip(position: Position) {
  return <span className={`chip is-${position.toLowerCase()}`}>{position}</span>
}

export function SquadScreen() {
  const game = useGame((s) => s.game)
  const inspect = useGame((s) => s.inspect)

  const squad = [...(game.squads[game.managedClubId] ?? [])].sort(
    (a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || overall(b) - overall(a),
  )
  const lineup = game.lineups[game.managedClubId]
  const starting = new Set(lineup?.starters ?? [])
  const club = game.clubs.find((c) => c.id === game.managedClubId)

  return (
    <section className="screen squad-screen">
      <h2 className="screen__heading">{club?.name ?? 'Squad'} · Squad</h2>
      <table className="data-table">
        <thead className="data-table__head">
          <tr>
            <th className="is-text">Pos</th>
            <th className="is-text">Player</th>
            <th>Age</th>
            <th>Ovr</th>
            <th className="is-text">Selected</th>
          </tr>
        </thead>
        <tbody>
          {squad.map((player: Player) => (
            <tr
              key={player.id}
              className="data-table__row is-clickable"
              tabIndex={0}
              onClick={() => inspect(player.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  inspect(player.id)
                }
              }}
            >
              <td className="is-text">{positionChip(player.position)}</td>
              <td className="is-text">{player.name}</td>
              <td>{ageOn(player, game.season.currentDate)}</td>
              <td>
                <strong>{overall(player)}</strong>
              </td>
              <td className="is-text squad-screen__selected">
                {starting.has(player.id) ? 'Starting XI' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
