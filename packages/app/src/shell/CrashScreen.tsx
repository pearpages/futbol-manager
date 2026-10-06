import { Component, type ErrorInfo, type ReactNode, useState } from 'react'
import { AUTOSAVE_SLOT } from '@fm/persistence'
import { Button, Confirm, Panel, ScreenActions } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import './CrashScreen.css'

/**
 * The last line of defence: anything that throws while rendering lands here
 * instead of on a blank page.
 *
 * A save is checked on load (`readSave`, `isGameState`), but only as deep as the
 * first screen reads. One that is wrong further down would crash on every visit,
 * because the slot pointer restores it each time — so this offers the way out
 * that used to need clearing the site's data by hand.
 */
export class CrashBoundary extends Component<
  { readonly children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The one place a crash can still be read: the browser console, for a bug report.
    console.error(error, info.componentStack)
  }

  override render(): ReactNode {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

function CrashScreen(): React.JSX.Element {
  const { t } = useT()
  const currentSlot = useGame((s) => s.currentSlot)
  const remove = useGame((s) => s.remove)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="shell shell--landing">
      <main className="shell__stage">
        <Panel className="crash-screen" role="alert">
          <h1 className="crash-screen__title">{t('crash.title')}</h1>
          <p className="crash-screen__text">{t('crash.body')}</p>
          <ScreenActions>
            <Button
              type="button"
              icon="trash"
              onClick={() => {
                setConfirming(true)
              }}
            >
              {t('crash.deleteSave')}
            </Button>
            <Button
              primary
              type="button"
              onClick={() => {
                globalThis.location.reload()
              }}
            >
              {t('crash.reload')}
            </Button>
          </ScreenActions>
        </Panel>
      </main>
      {confirming && (
        <Confirm
          title={t('crash.deleteSave')}
          confirmLabel={t('saves.delete')}
          confirmIcon="trash"
          cancelLabel={t('action.cancel')}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            void remove(currentSlot ?? AUTOSAVE_SLOT).then(() => {
              globalThis.location.reload()
            })
          }}
        >
          {t('crash.confirmDelete')}
        </Confirm>
      )}
    </div>
  )
}
