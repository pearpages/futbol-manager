import { SettingsMenu as SettingsMenuView } from '@fm/design-system'
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n/index.ts'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'

const OPTIONS = LANGUAGES.map((value) => ({ value, name: LANGUAGE_NAMES[value] }))

/** The language button: the design system's menu, offering the game's three languages. */
export function SettingsMenu() {
  const { t, language } = useT()
  const setLanguage = useGame((s) => s.setLanguage)

  return (
    <SettingsMenuView
      languageLabel={t('action.language')}
      languages={OPTIONS}
      current={language}
      onChange={(value) => {
        setLanguage(value as (typeof LANGUAGES)[number])
      }}
    />
  )
}
