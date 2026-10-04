import { useState } from 'react'
import { Button } from '../Button/Button.tsx'
import { Panel } from '../Panel/Panel.tsx'
import './SettingsMenu.css'

/** One language on the menu: its code, and its name as written in itself. */
export interface LanguageOption {
  readonly value: string
  readonly name: string
}

/**
 * The cog, where the news button used to be.
 *
 * One setting for now, so the menu is a list of three buttons rather than a
 * screen — a Settings *screen* for a single choice would be a hub tile, a title,
 * a Volver rail and a lot of ceremony around three words.
 *
 * Each language is named in its own language. That is the convention every
 * language menu follows, and the reason is practical: someone who has landed in
 * a language they cannot read needs to recognise the way out.
 */
export function SettingsMenu({
  label,
  languageLabel,
  languages,
  current,
  onChange,
}: {
  /** The cog's accessible name ("Settings"). */
  readonly label: string
  /** The heading over the choices ("Language"). */
  readonly languageLabel: string
  readonly languages: readonly LanguageOption[]
  /** The `value` of the language in use. */
  readonly current: string
  readonly onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <span className="settings">
      <Button
        type="button"
        className="settings__cog"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {/* Decorative: the accessible name is on the button. */}
        <svg className="settings__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm0 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z" />
          <path d="M10.6 1h2.8l.4 2.6q.9.3 1.7.8l2.4-1.1 2 3.4-2 1.7q.1.5.1 1t-.1 1l2 1.7-2 3.4-2.4-1.1q-.8.5-1.7.8L13.4 23h-2.8l-.4-2.8q-.9-.3-1.7-.8l-2.4 1.1-2-3.4 2-1.7q-.1-.5-.1-1t.1-1l-2-1.7 2-3.4 2.4 1.1q.8-.5 1.7-.8z" />
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
