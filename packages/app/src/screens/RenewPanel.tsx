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
  // The hint, and the refusal once there is one, read out with each field.
  const described = error === null ? 'renew-hint' : 'renew-hint renew-error'

  return (
    <Modal
      title={t('renew.title', { player: player.name })}
      onClose={onClose}
      full
      closeLabel={t('action.close')}
    >
      <div className="renew">
        <ScreenNote>
          {/* The year is written bare, never through `count`. A year is an
              identifier rather than a quantity, and the thousands separator makes
              it "2,027" — the same class of mistake as pricing a €13.80 ticket
              through a formatter that works in thousands. */}
          {t('renew.current', {
            wage: money(player.contract.wage),
            year: toCivil(player.contract.until).y,
          })}
        </ScreenNote>

        <Field>
          <FieldLabel htmlFor="renew-wage">
            {t('market.wageField', { wage: money(wanted.wage) })}
          </FieldLabel>
          <NumberInput
            id="renew-wage"
            type="number"
            min={0}
            step={50}
            value={wage}
            aria-describedby={described}
            onChange={(event) => setWage(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="renew-years">{t('market.yearsField')}</FieldLabel>
          <NumberInput
            id="renew-years"
            type="number"
            min={MIN_CONTRACT_YEARS}
            max={MAX_CONTRACT_YEARS}
            step={1}
            value={years}
            aria-describedby={described}
            onChange={(event) => setYears(event.target.value)}
          />
        </Field>

        <Hint id="renew-hint">{t('renew.hint')}</Hint>

        {error !== null && (
          <ScreenNote className="is-out" role="alert" id="renew-error">
            {error}
          </ScreenNote>
        )}

        <ScreenActions className="renew__actions">
          <Button type="button" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            icon="sign"
            primary
            type="button"
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
          </Button>
        </ScreenActions>
      </div>
    </Modal>
  )
}
