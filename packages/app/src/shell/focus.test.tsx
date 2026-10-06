import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'

/**
 * Where a keyboard and a screen reader are after something changes the screen
 * (WCAG 2.4.3, 4.1.3): the title of the page, where focus lands, and what the
 * shell's one live region says.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t, date } = translatorFor('en')
const nav = () => within(screen.getByRole('navigation', { name: t('tab.nav') }))
const status = () => document.querySelector('.shell > [role=status]')

beforeEach(() => {
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
})

describe('arriving on a screen', () => {
  it("names the page after the screen you're on", () => {
    render(<App />)
    expect(document.title).toBe(t('shell.documentTitle', { screen: t('tab.today') }))
    fireEvent.click(nav().getByRole('button', { name: t('tab.league') }))
    expect(document.title).toBe(t('shell.documentTitle', { screen: t('tab.league') }))
  })

  it('takes focus to the new title when the pressed control went with the old screen', () => {
    useGame.getState().go('squad')
    render(<App />)
    const link = document.querySelector<HTMLButtonElement>('.player-link')
    if (link === null) throw new Error('no player link')
    link.focus()
    fireEvent.click(link)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    expect(document.activeElement?.textContent).toBe(t('nav.player'))

    const backButton = screen.getByRole('button', { name: t('action.back') })
    backButton.focus()
    fireEvent.click(backButton)
    expect(document.activeElement?.textContent).toBe(t('tab.team'))
  })

  it('leaves focus on a tab that is still there, and says where you are', () => {
    render(<App />)
    const tab = nav().getByRole('button', { name: t('tab.league') })
    tab.focus()
    fireEvent.click(tab)
    expect(document.activeElement).toBe(tab)
    expect(status()?.textContent).toBe(t('tab.league'))
  })
})

describe('advancing a day', () => {
  it('says the new date', () => {
    render(<App />)
    act(() => {
      useGame.getState().dispatch({ type: 'AdvanceDay' })
    })
    const day = useGame.getState().game.season.currentDate
    expect(status()?.textContent).toContain(t('shell.dayAnnounce', { date: date(day) }))
  })
})
