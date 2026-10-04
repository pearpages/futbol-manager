import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsMenu } from './SettingsMenu.tsx'

const languages = [
  { value: 'ca', name: 'Català' },
  { value: 'en', name: 'English' },
]

describe('SettingsMenu', () => {
  it('opens from the cog, marks the current language and picks another', () => {
    const onChange = vi.fn()
    render(
      <SettingsMenu
        label="Settings"
        languageLabel="Language"
        languages={languages}
        current="ca"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Català' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(onChange).toHaveBeenCalledWith('en')
    expect(screen.queryByRole('group', { name: 'Language' })).toBeNull()
  })
})
