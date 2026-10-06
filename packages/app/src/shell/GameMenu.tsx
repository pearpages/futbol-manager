import { useRef, useState } from 'react'
import { Button, Confirm, Icon, Panel, Segments, Toast, useDismiss } from '@fm/design-system'
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n/index.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { useQuickSave } from '../useQuickSave.ts'
import { SaveManagerModal } from '../screens/SaveManagerModal.tsx'
import { SettingsMenu } from '../screens/SettingsMenu.tsx'
import { ShellCredit } from '../screens/ShellCredit.tsx'

const LANGUAGE_OPTIONS = LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_NAMES[value],
  lang: value,
}))

/**
 * Everything you do to the game rather than in it: save, the saves, the
 * language and leaving. The same four, with the same icons, at every width
 * (ADR 0022). On a phone they wait behind one button in the bar's corner;
 * on the desk there is room, so they sit in the bar itself.
 */
export function GameMenu({ inline = false }: { readonly inline?: boolean }): React.JSX.Element {
  const language = useGame((s) => s.language)
  const setLanguage = useGame((s) => s.setLanguage)
  const quitToLanding = useGame((s) => s.quitToLanding)
  const { t, date } = useT()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  // Closing the menu takes the pressed item with it. Focus goes back to ⋯ first,
  // so a dialog opened from the menu hands focus back there, not to <body>.
  const closeMenu = () => {
    setOpen(false)
    toggle.current?.focus()
  }
  useDismiss(ref, open, () => {
    setOpen(false)
  })
  const [savesOpen, setSavesOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { quickSave, saving, savedOn } = useQuickSave(() => {
    setSavesOpen(true)
  })

  if (inline) {
    return (
      <span className="game-menu game-menu--inline">
        <Button type="button" icon="save" disabled={saving} onClick={quickSave}>
          {saving ? t('action.saving') : t('action.save')}
        </Button>
        <Button
          type="button"
          icon="saves"
          onClick={() => {
            setSavesOpen(true)
          }}
        >
          {t('action.saves')}
        </Button>
        <Button
          type="button"
          icon="exit"
          onClick={() => {
            setLeaving(true)
          }}
        >
          {t('action.quit')}
        </Button>
        <SettingsMenu />
        {savedOn !== null && (
          <Toast
            className="shell-toast"
            message={t('action.saved', { date: date(savedOn) })}
            onDismiss={() => {}}
            duration={4000}
          />
        )}

        {savesOpen && (
          <SaveManagerModal
            onClose={() => {
              setSavesOpen(false)
            }}
          />
        )}

        {leaving && (
          <Confirm
            title={t('action.quit')}
            confirmLabel={t('action.quit')}
            confirmIcon="exit"
            cancelLabel={t('action.cancel')}
            onConfirm={quitToLanding}
            onCancel={() => {
              setLeaving(false)
            }}
          >
            <p>{t('hub.confirmQuit')}</p>
          </Confirm>
        )}
      </span>
    )
  }

  return (
    <span className="game-menu" ref={ref}>
      <Button
        type="button"
        ref={toggle}
        className="shell-bar__icon-button"
        aria-label={t('action.menu')}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
        }}
      >
        <Icon name="more" />
      </Button>

      {open && (
        <Panel className="game-menu__panel" role="group" aria-label={t('action.menu')}>
          <Button
            type="button"
            className="game-menu__item"
            disabled={saving}
            onClick={() => {
              closeMenu()
              quickSave()
            }}
          >
            <Icon name="save" />
            {saving ? t('action.saving') : t('action.save')}
          </Button>
          <Button
            type="button"
            className="game-menu__item"
            onClick={() => {
              closeMenu()
              setSavesOpen(true)
            }}
          >
            <Icon name="saves" />
            {t('action.saves')}
          </Button>
          <p className="game-menu__label">{t('action.language')}</p>
          <Segments
            label={t('action.language')}
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={setLanguage}
          />
          <Button
            type="button"
            className="game-menu__item"
            onClick={() => {
              closeMenu()
              setLeaving(true)
            }}
          >
            <Icon name="exit" />
            {t('action.quit')}
          </Button>
          <ShellCredit />
        </Panel>
      )}

      {savedOn !== null && (
        <Toast
          className="shell-toast"
          message={t('action.saved', { date: date(savedOn) })}
          onDismiss={() => {}}
          duration={4000}
        />
      )}

      {savesOpen && (
        <SaveManagerModal
          onClose={() => {
            setSavesOpen(false)
          }}
        />
      )}

      {leaving && (
        <Confirm
          title={t('action.quit')}
          confirmLabel={t('action.quit')}
          confirmIcon="exit"
          cancelLabel={t('action.cancel')}
          onConfirm={quitToLanding}
          onCancel={() => {
            setLeaving(false)
          }}
        >
          <p>{t('hub.confirmQuit')}</p>
        </Confirm>
      )}
    </span>
  )
}
