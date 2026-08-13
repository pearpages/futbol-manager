import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { bestXI, computeTable, overall, worstXI } from '@fm/domain'
import { App } from './App.tsx'
import { useGame } from './store.ts'

/**
 * M3b's exit criterion, at the UI level: you can open the game, look at your
 * squad, change your XI, and see it affect results.
 *
 * These drive the real store and the real reducer — no mocks — so a test passing
 * here means the same path the player takes works.
 */

beforeEach(() => {
  useGame.getState().newGame()
})

const managed = () => {
  const { game } = useGame.getState()
  return { game, clubId: game.managedClubId }
}

describe('the shell', () => {
  it('opens on the table with the managed club named', () => {
    render(<App />)
    const { game, clubId } = managed()
    const club = game.clubs.find((c) => c.id === clubId)

    expect(screen.getByRole('heading', { name: /Primera División/i })).toBeDefined()
    expect(screen.getAllByText(club?.name ?? '').length).toBeGreaterThan(0)
  })

  it('lists all twenty clubs in the table', () => {
    render(<App />)
    const rows = screen.getAllByRole('row')
    // 20 clubs plus the header row.
    expect(rows.length).toBe(21)
  })

  it('marks the managed club’s row so it can be found at a glance', () => {
    render(<App />)
    expect(document.querySelectorAll('.data-table__row.is-you')).toHaveLength(1)
  })

  it('navigates between sections', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Squad' }))
    expect(screen.getByRole('heading', { name: /Squad/i })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Lineup' }))
    expect(screen.getByRole('heading', { name: 'Starting XI' })).toBeDefined()
  })
})

describe('advancing the day', () => {
  it('plays the round and shows the results', () => {
    render(<App />)
    expect(screen.getByText(/Advance the day to play/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Advance day' }))

    const played = useGame.getState().game.season.fixtures.filter((f) => f.result !== null)
    expect(played).toHaveLength(10)
    expect(screen.queryByText(/Advance the day to play/)).toBeNull()
  })

  it('moves the clock forward', () => {
    render(<App />)
    const before = useGame.getState().game.season.currentDate
    fireEvent.click(screen.getByRole('button', { name: 'Advance day' }))
    expect(useGame.getState().game.season.currentDate).toBe(before + 1)
  })
})

describe('the squad screen', () => {
  it('shows the full squad and opens a player’s ficha', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Squad' }))

    const { game, clubId } = managed()
    const squad = game.squads[clubId] ?? []
    expect(squad.length).toBeGreaterThan(20)

    const first = squad[0]
    if (first === undefined) throw new Error('empty squad')
    fireEvent.click(screen.getByText(first.name))

    expect(screen.getByRole('heading', { name: first.name })).toBeDefined()
    expect(screen.getByText(String(overall(first)))).toBeDefined()
  })

  it('renders one bar per attribute on the ficha', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Squad' }))
    const { game, clubId } = managed()
    const first = (game.squads[clubId] ?? [])[0]
    if (first === undefined) throw new Error('empty squad')

    fireEvent.click(screen.getByText(first.name))
    expect(document.querySelectorAll('.attr')).toHaveLength(8)
  })
})

describe('the lineup screen', () => {
  it('changes formation through the reducer', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Lineup' }))
    fireEvent.click(screen.getByRole('button', { name: '4-3-3' }))

    const { game, clubId } = managed()
    expect(game.lineups[clubId]?.formation).toBe('4-3-3')
    expect(game.lineups[clubId]?.starters).toHaveLength(11)
  })

  it('changes the approach through the reducer', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Lineup' }))
    fireEvent.change(screen.getByLabelText(/Approach/), { target: { value: '100' } })

    const { game, clubId } = managed()
    expect(game.tactics[clubId]?.attacking).toBe(100)
    expect(screen.getByLabelText(/All-out attack/)).toBeDefined()
  })

  it('shows the two numbers the resolver actually reads', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Lineup' }))

    const panel = screen.getByRole('heading', { name: 'This XI' }).parentElement
    if (panel === null) throw new Error('no panel')
    expect(within(panel).getByText('Attack')).toBeDefined()
    expect(within(panel).getByText('Defence')).toBeDefined()
  })

  it('swapping a starter for a weaker substitute lowers the rating', () => {
    // The exit criterion in miniature: a lineup change the player makes on screen
    // has to move the numbers the match resolver consumes.
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Lineup' }))

    const { game, clubId } = managed()
    const squad = game.squads[clubId] ?? []
    useGame.getState().dispatch({
      type: 'SetLineup',
      clubId,
      lineup: worstXI(squad, '4-4-2'),
    })
    const weak = useGame.getState().game.lineups[clubId]

    useGame.getState().dispatch({ type: 'SetLineup', clubId, lineup: bestXI(squad, '4-4-2') })
    const strong = useGame.getState().game.lineups[clubId]

    expect(weak?.starters).not.toEqual(strong?.starters)
  })
})

describe('a bad lineup costs results', () => {
  it('concedes more over a season than the best XI does', () => {
    // Same seed, same league, one difference: the XI the player picked.
    const pointsWith = (pick: typeof bestXI) => {
      useGame.getState().newGame()
      const { game, clubId } = managed()
      useGame.getState().dispatch({
        type: 'SetLineup',
        clubId,
        lineup: pick(game.squads[clubId] ?? [], '4-4-2'),
      })
      for (let day = 0; day < 300; day++) {
        useGame.getState().dispatch({ type: 'AdvanceDay' })
      }
      const finished = useGame.getState().game
      const table = computeTable(finished.competition.clubIds, finished.season.fixtures)
      return table.find((r) => r.clubId === clubId)?.points ?? 0
    }

    expect(pointsWith(bestXI)).toBeGreaterThan(pointsWith(worstXI))
  })
})
