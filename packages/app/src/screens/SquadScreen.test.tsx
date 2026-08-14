import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { surplus } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'

/**
 * The sell side, at the UI level.
 *
 * Until M4c your squad was invisible to every other club — `runTransferWindow`
 * excluded your club from both roles, so nothing you owned was ever in front of a
 * buyer. Listing a player is the only way in, which makes this button the whole
 * feature.
 */

const MID = DEFAULT_CLUBS[13]?.id ?? ''

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const game = () => useGame.getState().game

function openSquad() {
  render(<App />)
  openScreen('Plantilla')
}

function rowFor(name: string) {
  const row = screen.getByText(name).closest('tr')
  if (row === null) throw new Error(`no row for ${name}`)
  return row
}

const aSpare = () => {
  const player = surplus(game().squads[game().managedClubId] ?? [])[0]
  if (player === undefined) throw new Error('nothing spare')
  return player
}

const aStarter = () => {
  const starters = new Set(game().lineups[game().managedClubId]?.starters ?? [])
  const player = (game().squads[game().managedClubId] ?? []).find((p) => starters.has(p.id))
  if (player === undefined) throw new Error('no starter')
  return player
}

describe('the squad screen', () => {
  it('says what each player is worth', () => {
    // There was no way to tell who was sellable, or for how much.
    openSquad()
    expect(screen.getByText('Worth')).toBeDefined()
    expect(document.body.textContent).toMatch(/€[\d.]+[kM]/)
  })

  it('lists a spare player, and the command reaches game state', () => {
    openSquad()
    const player = aSpare()

    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))

    expect(game().transferList).toEqual([player.id])
    expect(within(rowFor(player.name)).getByRole('button', { name: 'Listed' })).toBeDefined()
  })

  it('takes him off again', () => {
    openSquad()
    const player = aSpare()

    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))
    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'Listed' }))

    expect(game().transferList).toEqual([])
  })

  it('will not let you list a first-team player, and says why before you click', () => {
    // The reducer refuses this anyway. The button explaining itself up front is the
    // difference between a rule and an error message.
    openSquad()
    const button = within(rowFor(aStarter().name)).getByRole('button', { name: 'List' })

    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('title')).toMatch(/first team/)
  })

  it('survives navigating away and back', () => {
    openSquad()
    const player = aSpare()
    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))

    back()
    openScreen('Clasificación')
    back()
    openScreen('Plantilla')

    expect(within(rowFor(player.name)).getByRole('button', { name: 'Listed' })).toBeDefined()
  })
})

describe('the market screen shows what you have put up', () => {
  it('is explicit that nothing is on the market by default', () => {
    render(<App />)
    openScreen('Fichar')
    expect(screen.getByText(/Your squad is invisible to other clubs/)).toBeDefined()
  })

  it('lists him with an asking price once he is up for sale', () => {
    openSquad()
    const player = aSpare()
    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))

    back()
    openScreen('Fichar')
    const panel = screen.getByRole('heading', { name: 'Up for sale' }).closest('section')
    if (panel === null) throw new Error('no panel')

    expect(within(panel).getByText(player.name)).toBeDefined()
    fireEvent.click(within(panel).getByRole('button', { name: 'Take off' }))
    expect(game().transferList).toEqual([])
  })
})
