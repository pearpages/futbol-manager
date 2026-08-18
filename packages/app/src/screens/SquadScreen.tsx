import { useState } from 'react'
import {
  ageOn,
  askingPrice,
  expiresThisSeason,
  overall,
  type Player,
  type Position,
  saleBlock,
  toCivil,
} from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { type Sort, sortedBy } from '../sorting.ts'
import { useGame } from '../store.ts'
import { Explain } from './Explain.tsx'
import { PlayerLink } from './PlayerLink.tsx'
import { RenewPanel } from './RenewPanel.tsx'
import { SortHeader } from './SortHeader.tsx'
import './SquadScreen.css'

/**
 * Squad order: keepers, defenders, midfielders, forwards.
 *
 * Exported because the market's club browser lays a rival squad out the same way,
 * and because it is what a position column must sort on — the rendered chip is
 * `POR/DEF/MIG/DAV` in Catalan and `GK/DF/MF/FW` in English, which order the same
 * squad differently.
 */
export const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }

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
  const dispatch = useGame((s) => s.dispatch)
  const { t, money, locale } = useT()

  /** `null` is position-then-overall, the order a team sheet is written in. */
  const [sort, setSort] = useState<Sort<SortKey> | null>(null)
  /** Whose renewal dialog is open. Held by id so a rollover cannot strand a stale player. */
  const [renewing, setRenewing] = useState<string | null>(null)

  const roster = game.squads[game.managedClubId] ?? []
  const lineup = game.lineups[game.managedClubId]
  const starting = new Set(lineup?.starters ?? [])
  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const date = game.season.currentDate

  // Why each player cannot be sold, if he cannot. The button says so rather than
  // throwing when it is pressed, and it says *which* reason — one string for every
  // refusal is what made this screen unreadable: a man on the bench was told he was
  // in the first team, because the rule judged him against a 4-4-2 nobody was
  // playing.
  //
  // Asked of the *stored* squad rather than the sorted one, which used to matter a
  // great deal and now does not. `surplus` ran `bestXI`, ordering on `overall`
  // alone — and `Array.prototype.sort` is stable, so among players level on overall
  // whoever came first in the input took the shirt, and sorting this table changed
  // who you were allowed to sell. `saleBlock` reads the stored lineup and counts
  // keepers, so the answer no longer depends on row order at all. Kept as it is
  // because the stored squad is still the honest thing to ask about.
  const blocks = new Map(roster.map((player) => [player.id, saleBlock(roster, lineup, player)]))
  const listed = new Set(game.transferList)

  // Resolved against the live roster rather than held as an object. A player who
  // leaves while his dialog is open — sold, or retired across a rollover — closes
  // it rather than editing terms for somebody the club no longer has.
  const renewingPlayer = roster.find((player) => player.id === renewing) ?? null

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
      <h2 className="screen__heading">
        {t('squad.heading', { club: club?.name ?? '' })}
        <Explain topic="squadTable" />
      </h2>
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
            {/* Two columns of buttons — nothing to sort on. */}
            <th className="is-text">{t('squad.column.sale')}</th>
            <th className="is-text">{t('squad.column.contractAction')}</th>
          </tr>
        </thead>
        <tbody>
          {squad.map((player: Player, index: number) => {
            const block = blocks.get(player.id) ?? null
            const canSell = block === null
            const onSale = listed.has(player.id)
            const expiring = expiresThisSeason(player, game.season.startYear)
            return (
              <tr key={player.id} className="data-table__row">
                <td className="data-table__num">{index + 1}</td>
                <td className="is-text">
                  {positionChip(player.position, t(`position.${player.position}`))}
                </td>
                <td className="is-text">
                  <PlayerLink player={player} />
                </td>
                <td>{ageOn(player, date)}</td>
                <td>
                  <strong>{overall(player)}</strong>
                </td>
                <td>{money(askingPrice(player, date))}</td>
                <td>{money(player.contract.wage)}</td>
                {/* Contracts run to 30 June, so the year is the whole of it — a
                    full date would be four characters of noise on every row.
                    Red when that year is this season's: the one deal you can still
                    do something about. The year stays in its own text node so the
                    sentence beside it cannot be folded into the number, and the
                    leading space inside the hidden span is what keeps the cell's
                    accessible name from reading "2027His contract expires". */}
                <td className={expiring ? 'squad-screen__expiry is-expiring' : undefined}>
                  <span>{toCivil(player.contract.until).y}</span>
                  {expiring && <span className="visually-hidden"> {t('squad.expiring')}</span>}
                </td>
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
                    title={canSell || onSale ? undefined : t(`squad.cannotList.${block}`)}
                    onClick={() =>
                      dispatch({ type: 'ListPlayer', playerId: player.id, on: !onSale })
                    }
                  >
                    {onSale ? t('squad.listed') : t('squad.list')}
                  </button>
                </td>
                <td className="is-text squad-screen__sale">
                  {/* Never disabled. Renewal is available at any point in a deal,
                      and the reducer refuses the one case that would be a slip —
                      an offer shorter than the contract he is already on. */}
                  <button
                    type="button"
                    className="button squad-screen__list"
                    onClick={() => setRenewing(player.id)}
                  >
                    {t('squad.renew')}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {renewingPlayer !== null && (
        <RenewPanel
          key={renewingPlayer.id}
          player={renewingPlayer}
          onClose={() => setRenewing(null)}
        />
      )}
    </section>
  )
}
