import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from './App.tsx'
import { translatorFor } from './i18n/useT.ts'
import { useGame } from './store.ts'
import { openScreen } from './testing.ts'

/**
 * What a screen reader calls things. A row's buttons name the row's player, a
 * column of letters names itself in words, and a heading is only its words.
 */

const MID = DEFAULT_CLUBS[13]?.id ?? ''
const { t } = translatorFor('en')

beforeEach(() => {
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
})

const squad = () => useGame.getState().game.squads[MID] ?? []

describe('accessible names', () => {
  it("names each squad row's buttons after its player", () => {
    render(<App />)
    openScreen('nav.squad')
    const player = squad()[0]
    if (player === undefined) throw new Error('no squad')
    expect(
      screen.getByRole('button', { name: t('squad.renewPlayer', { player: player.name }) }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: t('squad.listPlayer', { player: player.name }) }),
    ).toBeDefined()
  })

  it("names the lineup's swap buttons after their player", () => {
    render(<App />)
    openScreen('nav.lineup')
    const starter = useGame.getState().game.lineups[MID]?.starters[0]
    const player = squad().find((p) => p.id === starter)
    if (player === undefined) throw new Error('no starter')
    expect(
      screen.getByRole('button', { name: t('lineup.pickPlayer', { player: player.name }) }),
    ).toBeDefined()
  })

  it('names a column of letters in words', () => {
    render(<App />)
    openScreen('nav.table')
    const head = within(document.querySelector('.data-table__head') as HTMLElement)
    expect(head.getByRole('columnheader', { name: t('column.full.won') })).toBeDefined()
    expect(head.getByRole('columnheader', { name: t('column.full.position') })).toBeDefined()
    expect(head.getByRole('columnheader', { name: t('table.qualification') })).toBeDefined()
  })

  it('keeps every explain button out of the heading beside it', () => {
    // Checked by structure, not by name: jsdom leaves a child button's
    // aria-label out of a heading's name, and Chrome reads it in ("Squad
    // Explain: …"), so a name query here passes either way.
    render(<App />)
    for (const place of ['nav.squad', 'nav.lineup', 'nav.calendar', 'nav.estadio']) {
      openScreen(place)
      for (const heading of screen.getAllByRole('heading')) {
        expect(heading.querySelector('button'), heading.textContent ?? '').toBeNull()
      }
    }
  })

  it("reads the hub's club once", () => {
    render(<App />)
    const club = useGame.getState().game.clubs.find((c) => c.id === MID)
    const crest = document.querySelector('.hub__crest')
    expect(crest?.querySelector('[role="img"]')).toBeNull()
    expect(crest?.textContent).toContain(club?.name)
  })
})
