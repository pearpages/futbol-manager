import { useEffect, useState } from 'react'
import { isSeasonComplete } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { matchdayFor } from '../matchday.ts'
import { useGame } from '../store.ts'
import { Button, Modal, Panel, ScreenActions } from '@fm/design-system'
import { usePhone } from '../usePhone.ts'
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

/** How long the quick-save confirmation stays up. */
const CONFIRM_MS = 4000

export function ShellFoot(): React.JSX.Element {
  const screen = useGame((s) => s.screen)
  const go = useGame((s) => s.go)
  const inspect = useGame((s) => s.inspect)
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const save = useGame((s) => s.save)
  const saving = useGame((s) => s.saving)
  const currentSlot = useGame((s) => s.currentSlot)
  const quitToLanding = useGame((s) => s.quitToLanding)

  const { t, date } = useT()

  const phone = usePhone()
  const [moreOpen, setMoreOpen] = useState(false)
  const [savesOpen, setSavesOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // The `n` is what makes two saves on the same day retrigger the timer; the
  // date alone would be an unchanged value and the effect would not re-run.
  const [saved, setSaved] = useState<{ readonly date: number; readonly n: number } | null>(null)

  useEffect(() => {
    if (saved === null) return
    const id = setTimeout(() => {
      setSaved(null)
    }, CONFIRM_MS)
    return () => {
      clearTimeout(id)
    }
  }, [saved])

  const onHub = screen === 'hub'
  const matchday = matchdayFor(game)
  const overForNow = game.board.sacked || isSeasonComplete(game)

  /**
   * One click, not two — but only once there is a save to write back to.
   *
   * A brand-new career has no slot, and writing one without a name would put it
   * where the picker cannot show it. That is the exact dead end this feature
   * shipped with the first time, so the first save goes through the dialog and
   * every one after it is a single press.
   */
  const quickSave = () => {
    if (currentSlot === null) {
      setSavesOpen(true)
      return
    }
    void save().then(() => {
      setSaved((previous) => ({ date: game.season.currentDate, n: (previous?.n ?? 0) + 1 }))
    })
  }

  const gameButtons = (
    <>
      <Button type="button" disabled={saving} onClick={quickSave}>
        {saving ? t('action.saving') : t('action.save')}
      </Button>
      <Button
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
          {/* On a phone the three go behind one button, so the footer stays one
              row (ADR 0018). Same buttons, same order, opening upwards. */}
          {phone ? (
            <span className="shell__more">
              <Button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => {
                  setMoreOpen(!moreOpen)
                }}
              >
                {t('action.more')}
              </Button>
              {moreOpen && (
                <Panel
                  className="shell__more-menu"
                  role="group"
                  aria-label={t('action.more')}
                  onClick={() => {
                    setMoreOpen(false)
                  }}
                >
                  {gameButtons}
                </Panel>
              )}
            </span>
          ) : (
            gameButtons
          )}
          {/* Says it worked. The label flicking to "Desant…" is over too fast to
              read, and a save with no visible result is indistinguishable from a
              broken button — which is how this feature was first reported. */}
          {saved !== null && (
            <span className="shell__saved" role="status">
              {t('action.saved', { date: date(saved.date) })}
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
            <Button primary type="button" onClick={() => dispatch({ type: 'AdvanceDay' })}>
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
            <Button primary type="button" onClick={quitToLanding}>
              {t('action.quit')}
            </Button>
          </ScreenActions>
        </Modal>
      )}
    </>
  )
}
