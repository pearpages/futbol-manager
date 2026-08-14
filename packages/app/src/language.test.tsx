import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from './App.tsx'
import { formatMoney, formatTicket, formatCount, formatDate } from './i18n/format.ts'
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, translate } from './i18n/index.ts'
import { translatorFor } from './i18n/useT.ts'
import { useGame } from './store.ts'
import { labelStem } from './testing.ts'
import type { DayNumber } from '@fm/domain'

/**
 * Three languages, switched from the cog.
 *
 * The rest of the suite runs pinned to English — see `test-setup.ts` — so this
 * is the one file that deliberately moves the language around.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const open = () => {
  const { t } = translatorFor(useGame.getState().language)
  fireEvent.click(screen.getByRole('button', { name: t('action.settings') }))
}

describe('the cog', () => {
  it('sits where the news button used to, and offers all three', () => {
    render(<App />)
    open()

    for (const name of Object.values(LANGUAGE_NAMES)) {
      expect(screen.getByRole('button', { name }), name).toBeDefined()
    }
  })

  it('names each language in its own language', () => {
    // Someone who has landed in a language they cannot read needs to recognise
    // the way out.
    expect(LANGUAGE_NAMES.ca).toBe('Català')
    expect(LANGUAGE_NAMES.es).toBe('Español')
    expect(LANGUAGE_NAMES.en).toBe('English')
  })

  it('changes the whole interface, not just the menu', () => {
    render(<App />)
    // The suite is pinned to English; this is the one place that moves it.
    expect(screen.getByRole('heading', { name: 'Following' })).toBeDefined()

    open()
    fireEvent.click(screen.getByRole('button', { name: 'Català' }))

    expect(screen.getByRole('heading', { name: 'Seguiment' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Following' })).toBeNull()

    open()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(screen.getByRole('heading', { name: 'Seguimiento' })).toBeDefined()
  })

  it('marks the language you are in', () => {
    render(<App />)
    open()
    const chosen = screen.getByRole('button', { name: 'English' })
    expect(chosen.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Català' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('tells the document what language it is in', () => {
    // `index.html` ships `lang="en"`, and it is the first thing a screen reader
    // uses to pick a voice.
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Català' }))
    expect(document.documentElement.lang).toBe('ca-ES')
  })

  it('remembers the choice for next time', () => {
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    expect(globalThis.localStorage.getItem('fm.language')).toBe('es')
  })

  it('is reachable before a career exists', () => {
    // The club picker replaces the whole shell, so it needs its own way in —
    // otherwise the first screen a player sees is the one screen he cannot
    // change the language of.
    useGame.getState().restart()
    render(<App />)
    open()
    expect(screen.getByRole('button', { name: 'Català' })).toBeDefined()
  })
})

describe('the default', () => {
  it('is Catalan', () => {
    expect(DEFAULT_LANGUAGE).toBe('ca')
  })

  it('survives a language nobody ships', () => {
    // A stale or hand-edited `localStorage` value must not blank the interface.
    globalThis.localStorage.setItem('fm.language', 'klingon')
    expect(translate('ca', 'nav.squad')).toBe('Plantilla')
    globalThis.localStorage.removeItem('fm.language')
  })
})

describe('numbers follow the language', () => {
  it('puts the currency where each language puts it', () => {
    // English prefixes, Catalan and Spanish postfix with a space. This is the
    // part `formatMoney` in `domain` could not know.
    expect(formatMoney('en', 12_400)).toBe('€12.4M')
    expect(formatMoney('ca', 12_400)).toBe('12,4 M€')
    expect(formatMoney('es', 12_400)).toBe('12,4 M€')
  })

  it('uses each language’s decimal separator', () => {
    expect(formatMoney('en', 1500)).toContain('.')
    expect(formatMoney('ca', 1500)).toContain(',')
  })

  it('groups thousands the way each language does', () => {
    expect(formatCount('en', 45_000)).toBe('45,000')
    expect(formatCount('ca', 45_000)).toBe('45.000')
    expect(formatCount('es', 45_000)).toBe('45.000')
  })

  it('prices a ticket in units rather than thousands', () => {
    // 0.0069 thousands is €6.90. Rendered through `formatMoney` it was "€0k".
    expect(formatTicket('en', 0.0069)).toBe('€6.90')
    expect(formatTicket('ca', 0.0069)).toBe('6,90 €')
  })

  it('orders a date the way each language reads it', () => {
    const day = 20_680 as DayNumber // 2026-08-15
    expect(formatDate('en', day)).toBe('2026-08-15')
    expect(formatDate('ca', day)).toBe('15/08/2026')
    expect(formatDate('es', day)).toBe('15/08/2026')
  })
})

describe('refusals are translated too', () => {
  it('says why in the language you are in', () => {
    // The reducer throws a code and keeps its English sentence; the screen shows
    // the code's translation, so the one screen where something went wrong is
    // not also the one screen that answers in the wrong language.
    // Set before rendering: a store write after `render` is outside React's
    // batching here, and the query would run against the previous pass.
    useGame.setState({ language: 'ca' })
    render(<App />)

    const { t } = translatorFor('ca')
    fireEvent.click(screen.getByRole('button', { name: t('nav.estadio') }))

    const seats = screen.getByLabelText(labelStem(t('estadio.seats', { cost: '' })))
    fireEvent.change(seats, { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: t('estadio.begin') }))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(t('error.expansion.range', { min: 1000, max: 15_000 }))
    // …and it is genuinely not the English the reducer still carries.
    expect(alert.textContent).not.toContain('An expansion runs')
  })
})

describe('nothing is left of the news drawer', () => {
  it('has no button, no badge and no drawer', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /Noticias|News/ })).toBeNull()
    expect(document.querySelector('.shell__news')).toBeNull()
    expect(document.querySelector('.shell__badge')).toBeNull()
    expect(document.querySelector('.shell__drawer')).toBeNull()
  })

  it('still reports the news on the hub, which is where you read it', () => {
    const { t } = translatorFor('en')
    render(<App />)
    const panel = screen.getByRole('heading', { name: t('hub.news') }).closest('section')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByText(t('hub.noNews'))).toBeDefined()
  })
})
