import { useState } from 'react'
import { Button, Confirm, Icon, Panel, Segments, Toast } from '@fm/design-system'
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n/index.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { useQuickSave } from '../useQuickSave.ts'
import { SaveManagerModal } from '../screens/SaveManagerModal.tsx'
import { ShellCredit } from '../screens/ShellCredit.tsx'

const LANGUAGE_OPTIONS = LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))

/**
 * Everything you do to the game rather than in it, behind one button in the
 * bar's corner: save, the saves, the language and leaving. On the desk these
 * are the footer's middle group and the language button; on a phone none of
 * them is pressed often enough to hold the bottom of the screen.
 */
export function PhoneMenu(): React.JSX.Element {
  const language = useGame((s) => s.language)
  const setLanguage = useGame((s) => s.setLanguage)
  const quitToLanding = useGame((s) => s.quitToLanding)
  const { t, date } = useT()

  const [open, setOpen] = useState(false)
  const [savesOpen, setSavesOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { quickSave, saving, savedOn } = useQuickSave(() => {
    setSavesOpen(true)
  })

  return (
    <span className="phone-menu">
      <Button
        type="button"
        className="phone-bar__icon-button"
        aria-label={t('action.menu')}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
        }}
      >
        <Icon name="more" />
      </Button>

      {open && (
        <Panel className="phone-menu__panel" role="group" aria-label={t('action.menu')}>
          <Button
            type="button"
            className="phone-menu__item"
            disabled={saving}
            onClick={() => {
              setOpen(false)
              quickSave()
            }}
          >
            <Icon name="save" />
            {saving ? t('action.saving') : t('action.save')}
          </Button>
          <Button
            type="button"
            className="phone-menu__item"
            onClick={() => {
              setOpen(false)
              setSavesOpen(true)
            }}
          >
            {t('action.saves')}
          </Button>
          <p className="phone-menu__label">{t('action.language')}</p>
          <Segments
            label={t('action.language')}
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={setLanguage}
          />
          <Button
            type="button"
            className="phone-menu__item"
            onClick={() => {
              setOpen(false)
              setLeaving(true)
            }}
          >
            {t('action.quit')}
          </Button>
          <ShellCredit />
        </Panel>
      )}

      {savedOn !== null && (
        <Toast
          className="phone-toast"
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
