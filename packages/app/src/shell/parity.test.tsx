import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { TABS } from './tabs.ts'

/**
 * One game at every width (ADR 0022, P20): the desk is the phone with more
 * room. Whatever a player can press on one, they can press on the other — the
 * same places, the same screens, the same actions, by the same names. Only
 * where they sit may differ.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')
const { t } = translatorFor('en')

function at(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone && query === '(width < 40rem)',
    addEventListener() {},
    removeEventListener() {},
  }))
}

/** Every control's name on the current screen, the menu opened if there is one. */
function controls(): string[] {
  const menu = screen.queryByRole('button', { name: t('action.menu') })
  if (menu !== null) fireEvent.click(menu)
  const names = screen
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '')
    // The menu's own toggle exists only where the items are folded away, and
    // the language is a menu on the desk and three choices on a phone.
    .filter((name) => name !== t('action.menu') && !/^(EN|CA|ES)\b/.test(name))
    .filter((name) => !['Català', 'Español', 'English'].includes(name))
  if (menu !== null) fireEvent.click(menu)
  return [...new Set(names)].sort()
}

/** The controls of every place, at one width. */
function walk(phone: boolean): Record<string, string[]> {
  at(phone)
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
  render(<App />)
  const seen: Record<string, string[]> = {}
  for (const place of TABS) {
    const nav = within(screen.getByRole('navigation', { name: t('tab.nav') }))
    fireEvent.click(nav.getByRole('button', { name: new RegExp(`^${t(place.label)}`) }))
    for (const target of place.screens) {
      useGame.getState().go(target)
      seen[target] = controls()
    }
  }
  cleanup()
  return seen
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the same game at every width', () => {
  it('offers the same controls on every screen, phone and desk', () => {
    const phone = walk(true)
    const desk = walk(false)
    expect(Object.keys(desk).sort()).toEqual(Object.keys(phone).sort())
    for (const target of Object.keys(phone)) {
      // The desk may add room, never a control of its own — and the phone may
      // not lose one. Screens differ only in what fits (wider tables), so this
      // compares the shell's controls: the bar, the menu, the action, the tabs.
      const shell = (names: string[]) =>
        names.filter((n) =>
          [
            t('hub.news'),
            t('action.save'),
            t('action.saves'),
            t('action.quit'),
            t('hub.advanceDay'),
            t('hub.toMatchday'),
            ...TABS.map((p) => t(p.label)),
          ].some((c) => n.startsWith(c)),
        )
      expect(shell(desk[target] ?? []), target).toEqual(shell(phone[target] ?? []))
    }
  })
})
