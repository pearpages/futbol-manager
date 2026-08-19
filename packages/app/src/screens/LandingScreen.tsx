import { useState } from 'react'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { SaveManagerModal } from './SaveManagerModal.tsx'
import { SettingsMenu } from './SettingsMenu.tsx'
import './LandingScreen.css'

/**
 * The front door. Shown every time the app opens, whether or not a career exists.
 *
 * Before this the app dropped a first-time visitor straight into a twenty-row
 * table of clubs with a one-line note, and a returning one straight into the hub.
 * Nothing anywhere said what the game was.
 *
 * Its own branch of the shell rather than a `Screen`, like the club picker: there
 * is no title bar, no `ShellFoot` and no career, so none of the career chrome
 * means anything here. The wordmark over the cover is the game's name, which is
 * why this branch has none in a bar — two copies of one name is the mistake this
 * codebase has removed twice already.
 */
export function LandingScreen(): React.JSX.Element {
  const { t } = useT()
  const needsSetup = useGame((s) => s.needsSetup)
  const currentSlot = useGame((s) => s.currentSlot)
  const storageBlocked = useGame((s) => s.storageBlocked)
  const sacked = useGame((s) => s.game.board.sacked)
  const continueCareer = useGame((s) => s.continueCareer)
  const startNewCareer = useGame((s) => s.startNewCareer)
  const [savesOpen, setSavesOpen] = useState(false)

  /*
   * Offered synchronously, which is why it asks `currentSlot` first.
   *
   * `restore()` is async and resolves a tick after this paints, so keying only on
   * `needsSetup` would pop a third button into the row under the reader's cursor
   * on the very first frame they ever see. `currentSlot` is read from
   * `localStorage` at store creation for precisely this reason — its own comment
   * says it has to be readable before the first `loadGame`. A pointer left
   * dangling by a save deleted in another tab lands on the club picker instead,
   * which is the same place doing nothing would have left them.
   *
   * The `sacked` gate is not incidental: without it Continue leads to a hub whose
   * only remaining button is "new career", which is a dead end reached through
   * the one door that promised otherwise.
   */
  const canContinue = (currentSlot !== null || !needsSetup) && !sacked

  return (
    <div className="landing">
      <div className="landing__settings">
        <SettingsMenu />
      </div>

      <div className="landing__hero">
        {/* Box art, and the only generated raster in the app — see ADR 0012. The
            lettering is deliberately *not* painted into it: an image model spells
            badly, and a real heading is crisper, translatable and announced. So
            the name is said exactly once, by the element that both shows it and
            carries it to assistive technology, and the picture stays decoration
            with an empty `alt` like every other drawing here. */}
        <figure className="landing__cover">
          <img className="cover" src="/cover.webp" alt="" aria-hidden="true" />
          <h1 className="landing__wordmark">{t('shell.wordmark')}</h1>
        </figure>
      </div>

      <section className="screen landing__aside">
        <h2 className="screen__heading">{t('landing.about.heading')}</h2>
        <p className="landing__tagline">{t('landing.tagline')}</p>

        {/* Storage being unreadable used to surface only on the club picker, which
            under this model you reach solely by asking for a new career. Someone
            with a saved game now meets this screen instead, and no Continue button
            with no explanation reads as "your career is gone". */}
        {storageBlocked && (
          <p className="screen__note is-out" role="alert">
            {t('setup.storageBlocked')}
          </p>
        )}

        <p className="landing__copy">{t('landing.about.p1')}</p>
        <p className="landing__copy">{t('landing.about.p2')}</p>
        <p className="landing__copy">{t('landing.about.p3')}</p>

        <div className="screen-actions landing__actions">
          {canContinue && (
            <button type="button" className="button is-primary" onClick={continueCareer}>
              {t('landing.continue')}
            </button>
          )}
          {/* Primary only when Continue is not there to be it. */}
          <button
            type="button"
            className={canContinue ? 'button' : 'button is-primary'}
            onClick={startNewCareer}
          >
            {t('action.newCareer')}
          </button>
          <button type="button" className="button" onClick={() => setSavesOpen(true)}>
            {t('landing.load')}
          </button>
        </div>
      </section>

      {/* The picker's second call site — `ShellFoot` is the first. It needs no
          knowledge of the landing: `load()` sets `entry` itself, so a successful
          load re-renders the shell into the career underneath this dialog. */}
      {savesOpen && <SaveManagerModal onClose={() => setSavesOpen(false)} />}
    </div>
  )
}
