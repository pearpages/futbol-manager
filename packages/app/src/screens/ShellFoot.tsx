import { useState } from 'react'
import { isSeasonComplete } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { matchdayFor } from '../matchday.ts'
import { useGame } from '../store.ts'
import { Button, Modal, Panel, ScreenActions } from '@fm/design-system'
import { useQuickSave } from '../useQuickSave.ts'
import { SaveManagerModal } from './SaveManagerModal.tsx'
import '../styles/shell-foot.css'

/**
 * The bar along the bottom: how you leave a screen, and what you do to the game.
 *
 * Three things drove it. **Tornar had no fixed home** — it sat at the foot of a
 * right-hand rail on six screens (three different rail widths, so three different
 * x positions), at the foot of the full-width panel on the squad screen where it
 * scrolled away with the table, and *top-right* on the ficha. **The hub's utility
 * panel had nowhere to live**: an 18rem column that, below 68rem, dropped it into
 * an implicit grid cell nobody designed. And **the day clock was hub-only**, so
 * the transfer-window loop was hub → advance → market → hub → advance → market.
 *
 * Three groups, always in the same order: leave · the game · the clock.
 */

export function ShellFoot(): React.JSX.Element {
  const screen = useGame((s) => s.screen)
  const go = useGame((s) => s.go)
  const inspect = useGame((s) => s.inspect)
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const quitToLanding = useGame((s) => s.quitToLanding)

  const { t, date } = useT()

  const [savesOpen, setSavesOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { quickSave, saving, savedOn } = useQuickSave(() => {
    setSavesOpen(true)
  })

  const onHub = screen === 'hub'
  const matchday = matchdayFor(game)
  const overForNow = game.board.sacked || isSeasonComplete(game)

  const gameButtons = (
    <>
      <Button icon="save" type="button" disabled={saving} onClick={quickSave}>
        {saving ? t('action.saving') : t('action.save')}
      </Button>
      <Button
        icon="saves"
        type="button"
        onClick={() => {
          setSavesOpen(true)
        }}
      >
        {t('action.saves')}
      </Button>
      {/* Furthest from the quick save on purpose: one is a press you make
                every few minutes and the other ends the career. */}
      <Button
        icon="exit"
        type="button"
        onClick={() => {
          setLeaving(true)
        }}
      >
        {t('action.quit')}
      </Button>
    </>
  )

  return (
    <>
      <Panel className="shell__foot">
        <div className="shell__foot-group">
          {/* Absent on the hub, which is where back goes. The *behaviour* stays
              contextual: a ficha opened from a two-hundred-row market list
              returns to that list, never to the hub. Only its position is
              now fixed. */}
          {!onHub && (
            <Button
              icon="back"
              type="button"
              onClick={() => {
                if (screen === 'player') inspect(null)
                else go('hub')
              }}
            >
              {t('action.back')}
            </Button>
          )}
        </div>

        <div className="shell__foot-group">
          {gameButtons}
          {/* Says it worked. The label flicking to "Desant…" is over too fast to
              read, and a save with no visible result is indistinguishable from a
              broken button — which is how this feature was first reported. */}
          {savedOn !== null && (
            <span className="shell__saved" role="status">
              {t('action.saved', { date: date(savedOn) })}
            </span>
          )}
        </div>

        <div className="shell__foot-group">
          {/* One button, in one corner, on every screen — the hub included.
              *
              Running the clock is the most repeated press in the game, so it has
              a fixed home rather than moving with the screen. Playing a match is
              not offered here: that press stays on the hub beside the fixture it
              is about, which is why the corner is empty on a matchday and Tornar
              is the way on. `Fins la jornada` stays there for the same reason —
              skipping several days at once is a decision about the fixture. */}
          {!overForNow && matchday !== null && !matchday.due && (
            <Button
              icon="step"
              primary
              type="button"
              onClick={() => dispatch({ type: 'AdvanceDay' })}
            >
              {t('hub.advanceDay')}
            </Button>
          )}
        </div>
      </Panel>

      {savesOpen && (
        <SaveManagerModal
          onClose={() => {
            setSavesOpen(false)
          }}
        />
      )}

      {leaving && (
        <Modal
          title={t('action.quit')}
          onClose={() => {
            setLeaving(false)
          }}
        >
          <p className="shell__question">{t('hub.confirmQuit')}</p>
          <ScreenActions>
            <Button
              type="button"
              onClick={() => {
                setLeaving(false)
              }}
            >
              {t('action.cancel')}
            </Button>
            <Button icon="exit" primary type="button" onClick={quitToLanding}>
              {t('action.quit')}
            </Button>
          </ScreenActions>
        </Modal>
      )}
    </>
  )
}
