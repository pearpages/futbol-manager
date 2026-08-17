import { useState } from 'react'
import {
  MAX_CONTRACT_YEARS,
  MIN_CONTRACT_YEARS,
  type Player,
  suggestedTerms,
  toCivil,
} from '@fm/domain'
import { useAttempt } from '../attempt.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { Modal } from './Modal.tsx'
import './RenewPanel.css'

/**
 * New terms for one of your own, as a dialog.
 *
 * **A dialog rather than a panel in a rail, and that is not taste.** M4b shipped
 * `NegotiationPanel` at the top of a scrolling aside while the button that opened
 * it sat at the bottom: the panel mounted above the viewport, the scroll offset
 * did not move, and the press read as a dead button. A modal cannot land
 * off-screen. It also brings Escape, the backdrop, the focus trap and returning
 * focus to whatever opened it, all of which `Modal` already owns.
 *
 * The two fields are prefilled from `suggestedTerms` — what he would actually sign
 * for today — so the common case is open, read, confirm. It is still a
 * negotiation: `offerTerms` in the reducer can refuse both the wage and the
 * length, and a refusal leaves the state alone rather than throwing.
 */
interface RenewPanelProps {
  readonly player: Player
  readonly onClose: () => void
}

export function RenewPanel({ player, onClose }: RenewPanelProps): React.JSX.Element {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const translator = useT()
  const { t, money } = translator

  const date = game.season.currentDate
  const wanted = suggestedTerms(player, date)

  // `useState` initialisers run once, so a prefill is a remount rather than an
  // effect — the lesson `NegotiationPanel` paid for, where switching between two
  // bids left the first man's wage in the field.
  //
  // Here the remount comes from the dialog being unmounted on close, so the `key`
  // at both call sites is belt-and-braces rather than the mechanism: removing it
  // fails nothing today, and it is checked by nothing. It earns its place the
  // moment anything lets you move between players without closing. What *is*
  // tested is the claim that matters — each dialog opens on that player's own
  // suggested terms.
  const [wage, setWage] = useState(String(wanted.wage))
  const [years, setYears] = useState(String(wanted.years))

  const { error, attempt } = useAttempt(game, translator)

  return (
    <Modal title={t('renew.title', { player: player.name })} onClose={onClose}>
      <div className="renew">
        <p className="screen__note">
          {/* The year is written bare, never through `count`. A year is an
              identifier rather than a quantity, and the thousands separator makes
              it "2,027" — the same class of mistake as pricing a €13.80 ticket
              through a formatter that works in thousands. */}
          {t('renew.current', {
            wage: money(player.contract.wage),
            year: toCivil(player.contract.until).y,
          })}
        </p>

        <div className="field">
          <label className="field__label" htmlFor="renew-wage">
            {t('market.wageField', { wage: money(wanted.wage) })}
          </label>
          <input
            id="renew-wage"
            className="number-input"
            type="number"
            min={0}
            step={50}
            value={wage}
            onChange={(event) => setWage(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="renew-years">
            {t('market.yearsField')}
          </label>
          <input
            id="renew-years"
            className="number-input"
            type="number"
            min={MIN_CONTRACT_YEARS}
            max={MAX_CONTRACT_YEARS}
            step={1}
            value={years}
            onChange={(event) => setYears(event.target.value)}
          />
        </div>

        <p className="hint">{t('renew.hint')}</p>

        {error !== null && (
          <p className="screen__note is-out" role="alert">
            {error}
          </p>
        )}

        <div className="screen-actions renew__actions">
          <button type="button" className="button" onClick={onClose}>
            {t('action.cancel')}
          </button>
          <button
            type="button"
            className="button is-primary"
            onClick={() => {
              const events = attempt(() =>
                dispatch({
                  type: 'RenewContract',
                  playerId: player.id,
                  wage: Number(wage),
                  years: Number(years),
                }),
              )
              // Close only when it actually happened. A refusal keeps the dialog
              // up with its reason and the numbers still in the fields, which is
              // the whole point of a refusal being an outcome rather than a
              // throw; closing regardless would look identical to success.
              if (events?.some((event) => event.type === 'ContractRenewed')) onClose()
            }}
          >
            {t('renew.offer')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
