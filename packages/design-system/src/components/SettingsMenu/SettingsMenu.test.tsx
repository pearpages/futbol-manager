import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsMenu } from './SettingsMenu.tsx'

const languages = [
  { value: 'ca', name: 'Català' },
  { value: 'en', name: 'English' },
]

describe('SettingsMenu', () => {
  it('shows the code, opens, marks the current language and picks another', () => {
    const onChange = vi.fn()
    render(
      <SettingsMenu
        languageLabel="Language"
        languages={languages}
        current="ca"
        onChange={onChange}
      />,
    )
    const toggle = screen.getByRole('button', { name: 'CA Language' })
    expect(toggle.textContent).toBe('CA Language')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Català' }).getAttribute('aria-pressed')).toBe('true')
    // Each language is spoken in its own voice.
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('lang')).toBe('en')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(onChange).toHaveBeenCalledWith('en')
    expect(screen.queryByRole('group', { name: 'Language' })).toBeNull()
  })
})
