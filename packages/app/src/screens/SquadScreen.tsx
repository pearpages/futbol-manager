import {
  ageOn,
  askingPrice,
  formatMoney,
  overall,
  type Player,
  type Position,
  surplus,
} from '@fm/domain'
import { useGame } from '../store.ts'
import './SquadScreen.css'

const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }

export function positionChip(position: Position) {
  return <span className={`chip is-${position.toLowerCase()}`}>{position}</span>
}

export function SquadScreen() {
  const game = useGame((s) => s.game)
  const inspect = useGame((s) => s.inspect)
  const dispatch = useGame((s) => s.dispatch)

  const squad = [...(game.squads[game.managedClubId] ?? [])].sort(
    (a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || overall(b) - overall(a),
  )
  const lineup = game.lineups[game.managedClubId]
  const starting = new Set(lineup?.starters ?? [])
  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const date = game.season.currentDate

  // Who you are allowed to sell, by the same rule the AI sells by. A player you
  // cannot spare is not listable, and the button says so rather than throwing when
  // it is pressed.
  const spare = new Set(surplus(squad).map((player) => player.id))
  const listed = new Set(game.transferList)

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
            <th>Worth</th>
            <th className="is-text">Selected</th>
            <th className="is-text">Sale</th>
          </tr>
        </thead>
        <tbody>
          {squad.map((player: Player) => {
            const canSell = spare.has(player.id)
            const onSale = listed.has(player.id)
            return (
              <tr key={player.id} className="data-table__row">
                <td className="is-text">{positionChip(player.position)}</td>
                <td className="is-text">
                  <button
                    type="button"
                    className="squad-screen__name"
                    onClick={() => inspect(player.id)}
                  >
                    {player.name}
                  </button>
                </td>
                <td>{ageOn(player, date)}</td>
                <td>
                  <strong>{overall(player)}</strong>
                </td>
                <td>{formatMoney(askingPrice(player, date))}</td>
                <td className="is-text squad-screen__selected">
                  {starting.has(player.id) ? 'Starting XI' : '—'}
                </td>
                <td className="is-text squad-screen__sale">
                  <button
                    type="button"
                    className={`button squad-screen__list${onSale ? ' is-primary' : ''}`}
                    aria-pressed={onSale}
                    // Unlisting stays available even once he is back in the XI —
                    // otherwise a listed player who wins his place back is stuck on
                    // a list you cannot clear.
                    disabled={!canSell && !onSale}
                    title={
                      canSell || onSale
                        ? undefined
                        : 'He is in your first team — you cannot list him'
                    }
                    onClick={() =>
                      dispatch({ type: 'ListPlayer', playerId: player.id, on: !onSale })
                    }
                  >
                    {onSale ? 'Listed' : 'List'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
