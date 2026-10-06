import { useRef, useState } from 'react'
import { useDismiss } from '../../useDismiss.ts'
import { Button } from '../Button/Button.tsx'
import { Panel } from '../Panel/Panel.tsx'
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx'
import './SettingsMenu.css'

/** One language on the menu: its code, and its name as written in itself. */
export interface LanguageOption {
  readonly value: string
  readonly name: string
}

/**
 * The language in use, as its code (CA ▾), opening the list of languages.
 *
 * It used to be a cog, and at this size the cog read as a blob: nobody could
 * tell what it did. A language code needs no icon and is recognisable in any
 * language, which is what someone who has landed in the wrong one needs.
 *
 * One setting for now, so the menu is a list of three buttons rather than a
 * screen — a Settings *screen* for a single choice would be a hub tile, a title,
 * a Volver rail and a lot of ceremony around three words.
 *
 * Each language is named in its own language. That is the convention every
 * language menu follows, and the reason is practical: someone who has landed in
 * a language they cannot read needs to recognise the way out. Each choice
 * carries its own `lang`, so a screen reader says "Català" in a Catalan voice.
 */
export function SettingsMenu({
  languageLabel,
  languages,
  current,
  onChange,
}: {
  /** The heading over the choices, and the button's name after the code ("Language"). */
  readonly languageLabel: string
  readonly languages: readonly LanguageOption[]
  /** The `value` of the language in use. */
  readonly current: string
  readonly onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useDismiss(ref, open, () => {
    setOpen(false)
  })

  return (
    <span className="settings" ref={ref}>
      <Button
        type="button"
        className="settings__toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {current.toUpperCase()} <VisuallyHidden>{languageLabel}</VisuallyHidden>
        <svg className="settings__caret" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M0 0h10L5 6z" />
        </svg>
      </Button>

      {open && (
        <Panel className="settings__menu" role="group" aria-label={languageLabel}>
          <p className="settings__label">{languageLabel}</p>
          {languages.map(({ value: option, name }) => (
            <Button
              primary={option === current}
              key={option}
              type="button"
              className="settings__choice"
              aria-pressed={option === current}
              lang={option}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
            >
              {name}
            </Button>
          ))}
        </Panel>
      )}
    </span>
  )
}
