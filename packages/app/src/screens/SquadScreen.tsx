import { ageOn, askingPrice, overall, type Player, type Position, surplus } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import './SquadScreen.css'

const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }

/**
 * The position, as a coloured tag.
 *
 * `GK`/`DF`/`MF`/`FW` are identifiers in `domain` — they key `FORMATIONS` and
 * `POSITION_WEIGHTS` — so they are translated here at the one place they are
 * rendered, and nowhere near the data.
 */
export function positionChip(position: Position, label: string) {
  return <span className={`chip is-${position.toLowerCase()}`}>{label}</span>
}

export function SquadScreen() {
  const game = useGame((s) => s.game)
  const inspect = useGame((s) => s.inspect)
  const dispatch = useGame((s) => s.dispatch)
  const go = useGame((s) => s.go)
  const { t, money } = useT()

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
      <h2 className="screen__heading">{t('squad.heading', { club: club?.name ?? '' })}</h2>
      <table className="data-table">
        <thead className="data-table__head">
          <tr>
            {/* A running count, not a shirt number. Squad size is load-bearing —
                you cannot buy at MAX_SQUAD and cannot sell at MIN_SQUAD — so the
                last row tells you where you sit between 18 and 30. */}
            <th>{t('squad.column.number')}</th>
            <th className="is-text">{t('squad.column.position')}</th>
            <th className="is-text">{t('squad.column.player')}</th>
            <th>{t('squad.column.age')}</th>
            <th>{t('squad.column.overall')}</th>
            <th>{t('squad.column.worth')}</th>
            <th className="is-text">{t('squad.column.selected')}</th>
            <th className="is-text">{t('squad.column.sale')}</th>
          </tr>
        </thead>
        <tbody>
          {squad.map((player: Player, index: number) => {
            const canSell = spare.has(player.id)
            const onSale = listed.has(player.id)
            return (
              <tr key={player.id} className="data-table__row">
                <td className="data-table__num">{index + 1}</td>
                <td className="is-text">
                  {positionChip(player.position, t(`position.${player.position}`))}
                </td>
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
                <td>{money(askingPrice(player, date))}</td>
                <td className="is-text squad-screen__selected">
                  {starting.has(player.id) ? t('squad.starting') : t('squad.notSelected')}
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
                    title={canSell || onSale ? undefined : t('squad.cannotList')}
                    onClick={() =>
                      dispatch({ type: 'ListPlayer', playerId: player.id, on: !onSale })
                    }
                  >
                    {onSale ? t('squad.listed') : t('squad.list')}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="screen-actions">
        <button type="button" className="button" onClick={() => go('hub')}>
          {t('action.back')}
        </button>
      </div>
    </section>
  )
}
