import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { canField, FORMATION_NAMES } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { translatorFor } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'

/**
 * The lineup screen's formation buttons.
 *
 * There was no test file for this screen at all until the second batch of shapes
 * arrived — `App.test.tsx` only ever drove the slider.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const { t } = translatorFor('en')
const game = () => useGame.getState().game
const squadOf = () => game().squads[game().managedClubId] ?? []

/** Drops the managed club to `keep` players at one position. */
function trimForwards(keep: number): void {
  const squad = squadOf()
  const forwards = squad.filter((p) => p.position === 'FW')
  const dropped = new Set(forwards.slice(keep).map((p) => p.id))
  useGame.setState({
    game: {
      ...game(),
      squads: {
        ...game().squads,
        [game().managedClubId]: squad.filter((p) => !dropped.has(p.id)),
      },
    },
  })
}

describe('formation buttons', () => {
  it('offers every shape to a full squad', () => {
    render(<App />)
    openScreen('nav.lineup')

    for (const formation of FORMATION_NAMES) {
      const button = screen.getByRole('button', { name: formation })
      expect(button.hasAttribute('disabled'), formation).toBe(false)
    }
    back()
  })

  it('disables a shape the squad cannot fill, and only that one', () => {
    // Pressing it would call `bestXI`, which throws — in an event handler, with
    // no error boundary anywhere in the app. The button is the visible half of
    // that guard; the reducer-side half is in the domain's formations.test.ts.
    render(<App />)
    trimForwards(3)
    openScreen('nav.lineup')

    const squad = squadOf()
    expect(squad.filter((p) => p.position === 'FW')).toHaveLength(3)

    for (const formation of FORMATION_NAMES) {
      const button = screen.getByRole('button', { name: formation })
      // Asserted against `canField` rather than a hardcoded list, so this keeps
      // meaning something when the next shape lands.
      expect(button.hasAttribute('disabled'), formation).toBe(!canField(squad, formation))
    }

    // The guard on the guard: if nothing were disabled the loop above would pass
    // trivially, since `canField` would agree with an all-enabled row.
    expect(screen.getByRole('button', { name: '4-2-4' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '4-4-2' }).hasAttribute('disabled')).toBe(false)
    back()
  })

  it('says why, rather than just going dead', () => {
    render(<App />)
    trimForwards(3)
    openScreen('nav.lineup')

    expect(screen.getByRole('button', { name: '4-2-4' }).getAttribute('title')).toBe(
      t('lineup.cannotField'),
    )
    expect(screen.getByRole('button', { name: '4-4-2' }).getAttribute('title')).toBeNull()
    back()
  })
})

describe('the tempo readout', () => {
  /**
   * Scoped to the ratings panel on purpose. `approach.balanced` renders the word
   * "Balanced" too, inside `lineup.approach` a few centimetres up the same rail,
   * so a bare `getByText(/Balanced/)` matches two nodes and proves nothing.
   */
  const readTempo = () => {
    const panel = document.querySelector('.lineup-screen__ratings')
    if (panel === null) throw new Error('no ratings panel')
    return within(panel as HTMLElement).getByText(
      new RegExp(`^(${[t('tempo.open'), t('tempo.balanced'), t('tempo.tight')].join('|')})$`),
    ).textContent
  }

  it('reads balanced on a fresh career', () => {
    // 4-4-2 at slider 50 is tempo exactly zero — the property the whole
    // FORMATION_TEMPO design rests on, asserted here from the player's side.
    render(<App />)
    openScreen('nav.lineup')
    expect(readTempo()).toBe(t('tempo.balanced'))
    back()
  })

  it('tightens when the shape contains the game', () => {
    render(<App />)
    openScreen('nav.lineup')
    fireEvent.click(screen.getByRole('button', { name: '5-4-1' }))
    expect(readTempo()).toBe(t('tempo.tight'))
    back()
  })

  it('opens up when the shape chases the game', () => {
    render(<App />)
    openScreen('nav.lineup')
    fireEvent.click(screen.getByRole('button', { name: '4-2-4' }))
    expect(readTempo()).toBe(t('tempo.open'))
    back()
  })

  it('answers to the slider as well as the shape', () => {
    // Both contributors are wired, not just the formation — the slider alone has
    // to be able to move it while the shape stays on the neutral 4-4-2.
    render(<App />)
    openScreen('nav.lineup')
    expect(readTempo()).toBe(t('tempo.balanced'))

    fireEvent.change(screen.getByLabelText(/Approach/), { target: { value: '100' } })
    expect(readTempo()).toBe(t('tempo.open'))

    fireEvent.change(screen.getByLabelText(/Approach/), { target: { value: '0' } })
    expect(readTempo()).toBe(t('tempo.tight'))
    back()
  })
})
