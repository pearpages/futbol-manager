import { useState } from 'react'
import { askingPrice, FINANCE, type Player, reluctancePremium, signingOutlay } from '@fm/domain'
import { useAttempt } from '../attempt.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import {
  Button,
  Field,
  FieldLabel,
  Hint,
  Modal,
  NumberInput,
  ScreenActions,
  ScreenNote,
} from '@fm/design-system'
import './BidPanel.css'

/**
 * An offer for somebody else's player, from his own card.
 *
 * **This is the route that makes bidding symmetric.** `MakeBid` used to be
 * reachable from exactly one place — the market screen's deal panel, opened from a
 * listing — and a listing is a club's `surplus`. So the only players you could bid
 * for were the ones their club had already given up on, while AI clubs were free
 * to offer for anyone of yours who was merely out of your team sheet. Hanging it
 * off the ficha instead makes it reachable from everywhere a `PlayerLink` goes.
 *
 * A dialog rather than a rail panel, for the reason `RenewPanel` records: M4b
 * shipped a panel that mounted above the scroll viewport and read as a dead
 * button. This is that panel's twin and deliberately looks like it.
 *
 * **Only the fee half.** Once a bid is accepted the deal is finished on the market
 * screen, where "Your bids" already reopens it for personal terms. Duplicating the
 * terms stage here would be a second copy of a flow this project has repeatedly
 * been bitten by having two of.
 */
interface BidPanelProps {
  readonly player: Player
  /**
   * Whoever holds him — a domestic club or one abroad. Narrowed to what this
   * reads, so a `ForeignClub` fits: the seller's squad comes from `game`, not
   * from the club, so nothing here needs a rating or a ledger.
   */
  readonly owner: { readonly id: string; readonly name: string }
  readonly onClose: () => void
}

export function BidPanel({ player, owner, onClose }: BidPanelProps): React.JSX.Element {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const translator = useT()
  const { t, money, percent, club } = translator

  const date = game.season.currentDate
  const sellerSquad = game.squads[owner.id] ?? game.foreign.squads[owner.id] ?? []
  const premium = reluctancePremium(sellerSquad, player)
  const wanted = Math.round(askingPrice(player, date) * premium)

  // Prefilled at what his club would actually take, so the common case is open,
  // read, confirm. A `useState` initialiser runs once; the dialog unmounts on
  // close, which is what makes that a remount rather than a stale field.
  const [fee, setFee] = useState(String(wanted))
  const { error, attempt } = useAttempt(game, translator)

  const outlay = signingOutlay(Number(fee) || 0)

  return (
    <Modal title={t('bid.title', { player: player.name })} onClose={onClose}>
      <div className="bid">
        {/* The mechanism, never the multiple. Naming the number would turn the
            squad screen into a lookup, which is exactly why the "Improves" column
            came off the market at M4c. */}
        <ScreenNote>
          {t(premium > 1 ? 'bid.reluctant' : 'bid.willing', {
            club: club(owner.name, { caps: true }),
          })}
        </ScreenNote>

        <Field>
          <FieldLabel htmlFor="bid-fee">{t('market.feeField', { fee: money(wanted) })}</FieldLabel>
          <NumberInput
            id="bid-fee"
            type="number"
            min={1}
            step={50}
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
        </Field>

        <Hint>
          {t('market.outlay', {
            bonus: money(outlay - (Number(fee) || 0)),
            total: money(outlay),
            percent: percent(FINANCE.SIGNING_BONUS),
          })}
        </Hint>
        <Hint>{t('market.bidHint')}</Hint>

        {error !== null && (
          <ScreenNote className="is-out" role="alert">
            {error}
          </ScreenNote>
        )}

        <ScreenActions className="bid__actions">
          <Button type="button" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            primary
            type="button"
            onClick={() => {
              const events = attempt(() =>
                dispatch({ type: 'MakeBid', playerId: player.id, fee: Number(fee) }),
              )
              // Close only when the bid was actually made. A refusal — his club is
              // at the squad floor, or you cannot afford it — keeps the dialog up
              // with its reason; closing regardless looks identical to success.
              if (events?.some((event) => event.type === 'BidMade')) onClose()
            }}
          >
            {t('market.makeBid')}
          </Button>
        </ScreenActions>
      </div>
    </Modal>
  )
}
