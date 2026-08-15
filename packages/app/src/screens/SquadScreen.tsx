import { useState } from 'react'
import {
  ageOn,
  askingPrice,
  overall,
  type Player,
  type Position,
  surplus,
  toCivil,
} from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { type Sort, sortedBy } from '../sorting.ts'
import { useGame } from '../store.ts'
import { SortHeader } from './SortHeader.tsx'
import './SquadScreen.css'

const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }

type SortKey = 'position' | 'name' | 'age' | 'overall' | 'worth' | 'wage' | 'contract' | 'selected'

/** Text columns read left, numbers read right — the `data-table` convention. */
const SORT_ALIGN: Readonly<Record<SortKey, string>> = {
  position: 'is-text',
  name: 'is-text',
  age: '',
  overall: '',
  worth: '',
  wage: '',
  contract: '',
  selected: 'is-text',
}

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
  const { t, money, locale } = useT()

  /** `null` is position-then-overall, the order a team sheet is written in. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)

  const roster = game.squads[game.managedClubId] ?? []
  const lineup = game.lineups[game.managedClubId]
  const starting = new Set(lineup?.starters ?? [])
  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const date = game.season.currentDate

  // Who you are allowed to sell, by the same rule the AI sells by. A player you
  // cannot spare is not listable, and the button says so rather than throwing when
  // it is pressed.
  //
  // Asked of the *stored* squad, never the sorted one. `surplus` runs `bestXI`,
  // which orders on `overall` alone — and `Array.prototype.sort` is stable, so among
  // players level on overall in a position, whoever comes first in the input takes
  // the shirt. That was harmless while the input order was fixed; the moment it is a
  // manager's click, which players are listable would change as he sorts the table.
  const spare = new Set(surplus(roster).map((player) => player.id))
  const listed = new Set(game.transferList)

  const ordered = [...roster].sort(
    (a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || overall(b) - overall(a),
  )
  const squad = sortedBy(ordered, sort, (player, key) => value(player, key), locale)

  /** The domain's own value for a column — never the rendered label. */
  function value(player: Player, key: SortKey): number | string {
    switch (key) {
      case 'position':
        // `POSITION_ORDER`, not the chip: `POR/DEF/MIG/DAV` and `GK/DF/MF/FW` sort
        // into different orders, so the label would make the squad language-dependent.
        return POSITION_ORDER[player.position]
      case 'name':
        return player.name
      case 'age':
        return ageOn(player, date)
      case 'overall':
        return overall(player)
      case 'worth':
        return askingPrice(player, date)
      case 'wage':
        return player.contract.wage
      case 'contract':
        return player.contract.until
      case 'selected':
        return starting.has(player.id) ? 1 : 0
    }
  }

  /** The shared header, bound to this screen's sort state. */
  function column(key: SortKey, label: string) {
    return (
      <SortHeader column={key} label={label} sort={sort} onSort={setSort} align={SORT_ALIGN[key]} />
    )
  }

  return (
    <section className="screen squad-screen">
      <h2 className="screen__heading">{t('squad.heading', { club: club?.name ?? '' })}</h2>
      <table className="data-table">
        <thead className="data-table__head">
          <tr>
            {/* A running count, not a shirt number. Squad size is load-bearing —
                you cannot buy at MAX_SQUAD and cannot sell at MIN_SQUAD — so the
                last row tells you where you sit between 18 and 30. It counts the
                rows as rendered, so it renumbers under a sort rather than sorting. */}
            <th>{t('squad.column.number')}</th>
            {column('position', t('squad.column.position'))}
            {column('name', t('squad.column.player'))}
            {column('age', t('squad.column.age'))}
            {column('overall', t('squad.column.overall'))}
            {column('worth', t('squad.column.worth'))}
            {/* What he costs you, and until when. The wage bill is a single figure
                on the Caja screen and was attributable to nobody; these two columns
                are where it comes from. */}
            {column('wage', t('squad.column.wage'))}
            {column('contract', t('squad.column.contract'))}
            {column('selected', t('squad.column.selected'))}
            {/* A column of buttons — nothing to sort on. */}
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
                <td>{money(player.contract.wage)}</td>
                {/* Contracts run to 30 June, so the year is the whole of it — a
                    full date would be four characters of noise on every row. */}
                <td>{toCivil(player.contract.until).y}</td>
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
