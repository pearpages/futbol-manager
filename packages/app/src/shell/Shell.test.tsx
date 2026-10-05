import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'

/**
 * The phone shell (ADR 0019). jsdom has no `matchMedia`, so every other test
 * sees the desk; here it is stubbed to answer the phone query.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const nav = () => within(screen.getByRole('navigation', { name: t('tab.nav') }))

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(width < 40rem)',
    addEventListener() {},
    removeEventListener() {},
  }))
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the phone shell', () => {
  it('replaces the desk bar and footer', () => {
    render(<App />)
    expect(document.querySelector('.shell--app')).not.toBeNull()
    expect(document.querySelector('.shell__foot')).toBeNull()
    expect(document.querySelector('.shell__bar')).toBeNull()
  })

  it('goes anywhere in one press, and a tab shows its screens as segments', () => {
    render(<App />)
    fireEvent.click(nav().getByRole('button', { name: t('tab.league') }))
    expect(useGame.getState().screen).toBe('table')
    expect(
      nav()
        .getByRole('button', { name: t('tab.league') })
        .getAttribute('aria-current'),
    ).toBe('page')

    const segments = within(screen.getByRole('group', { name: t('tab.league') }))
    // Each carries its hub tile's picture, hidden from the name.
    expect(
      segments.getAllByRole('button').every((b) => b.querySelector('.segments__icon svg') !== null),
    ).toBe(true)
    fireEvent.click(segments.getByRole('button', { name: t('nav.results') }))
    expect(useGame.getState().screen).toBe('results')

    fireEvent.click(nav().getByRole('button', { name: t('tab.team') }))
    expect(useGame.getState().screen).toBe('lineup')
  })

  it('plays the match from any screen, and shows the result', () => {
    useGame.getState().advanceToMatchday()
    useGame.getState().go('lineup')
    render(<App />)

    const play = screen.getByRole('button', { name: /^Play/ })
    const played = useGame.getState().game.season.currentDate
    fireEvent.click(play)
    expect(useGame.getState().game.season.currentDate).toBe(played + 1)

    const result = screen.getByRole('dialog', { name: t('result.title') })
    expect(result.textContent).toMatch(/\d–\d/)
    fireEvent.click(within(result).getByRole('button', { name: t('result.continue') }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Still where you were.
    expect(useGame.getState().screen).toBe('lineup')
  })

  it('keeps save, saves, language and quit behind the menu', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: t('action.saves') })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('action.menu') }))
    const menu = within(screen.getByRole('group', { name: t('action.menu') }))
    expect(menu.getByRole('button', { name: t('action.save') })).toBeDefined()
    expect(menu.getByRole('button', { name: t('action.saves') })).toBeDefined()
    expect(menu.getByRole('button', { name: t('action.quit') })).toBeDefined()

    fireEvent.click(menu.getByRole('button', { name: 'Català' }))
    expect(useGame.getState().language).toBe('ca')
  })

  it('swaps a starter from a sheet opened on the pitch', () => {
    useGame.getState().go('lineup')
    render(<App />)
    const before = useGame.getState().game.lineups[MID]?.starters ?? []
    const keeper = screen.getAllByRole('button').find((b) => b.classList.contains('pitch__slot'))
    if (keeper === undefined) throw new Error('no pitch slot')
    fireEvent.click(keeper)

    const sheet = screen.getByRole('dialog')
    fireEvent.click(within(sheet).getAllByRole('button')[0] as HTMLElement)
    const after = useGame.getState().game.lineups[MID]?.starters ?? []
    expect(after).not.toEqual(before)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('goes back from a player page to where it was opened', () => {
    useGame.getState().go('squad')
    const first = useGame.getState().game.squads[MID]?.[0]
    if (first === undefined) throw new Error('no squad')
    useGame.getState().inspect(first.id)
    render(<App />)
    expect(
      nav()
        .getByRole('button', { name: t('tab.team') })
        .getAttribute('aria-current'),
    ).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: t('action.back') }))
    expect(useGame.getState().screen).toBe('squad')
  })

  it('closes the menu on a press outside it', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: t('action.menu') }))
    expect(screen.getByRole('group', { name: t('action.menu') })).toBeDefined()
    fireEvent.pointerDown(document.querySelector('.shell__stage') as HTMLElement)
    expect(screen.queryByRole('group', { name: t('action.menu') })).toBeNull()
  })

  it('opens the news from any screen, and opening it reads it', () => {
    useGame.getState().go('market')
    useGame.setState({ unread: 3 })
    render(<App />)
    const news = screen.getByRole('button', {
      name: `${t('hub.news')} 3 ${t('action.unread.other', { count: 3 }).replace('3 ', '')}`,
    })
    fireEvent.click(news)
    expect(screen.getByRole('dialog', { name: t('hub.news') })).toBeDefined()
    expect(useGame.getState().unread).toBe(0)
    expect(screen.getByRole('button', { name: t('hub.news') })).toBeDefined()
  })

  it('filters the market from a sheet, and says how many filters are on', () => {
    useGame.getState().go('market')
    render(<App />)
    const rows = () => document.querySelectorAll('.market-screen__listings tbody tr').length
    const count = () => document.querySelector('.market-screen__count')?.textContent
    const before = count()

    fireEvent.click(screen.getByRole('button', { name: t('market.filters') }))
    const sheet = within(screen.getByRole('dialog', { name: t('market.filterTitle') }))
    fireEvent.click(sheet.getByRole('button', { name: t('position.GK') }))
    expect(count()).not.toBe(before)
    expect(rows()).toBeGreaterThan(0)
    fireEvent.click(sheet.getByRole('button', { name: /^Show/ }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('button', { name: t('market.filtersCount', { count: 1 }) }),
    ).toBeDefined()
    const chips = [...document.querySelectorAll('.market-screen__listings tbody tr .chip')]
    expect(chips.every((c) => c.textContent === t('position.GK'))).toBe(true)
  })

  it('sorts the market from a sheet', () => {
    useGame.getState().go('market')
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', {
        name: t('market.sortBy', { key: t('market.sort.market') }),
      }),
    )
    const sheet = within(screen.getByRole('dialog', { name: t('market.sortTitle') }))
    fireEvent.click(sheet.getByRole('button', { name: t('market.sort.age') }))
    const ages = [
      ...document.querySelectorAll('.market-screen__listings tbody tr td:nth-child(4)'),
    ].map((td) => Number(td.textContent))
    expect(ages.length).toBeGreaterThan(1)
    expect(ages).toEqual([...ages].sort((a, b) => b - a))
  })
})
