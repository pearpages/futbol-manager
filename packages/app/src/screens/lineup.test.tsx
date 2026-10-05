import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { bestXI, canField, FORMATION_NAMES, FORMATIONS } from '@fm/domain'
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
  // Starters first, so the trim never leaves the lineup naming a man who is gone
  // (which club sits at this index, and so who starts, moves with the data).
  const starters = new Set(game().lineups[game().managedClubId]?.starters ?? [])
  const forwards = squad
    .filter((p) => p.position === 'FW')
    .sort((a, b) => Number(starters.has(b.id)) - Number(starters.has(a.id)))
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

describe('the team sheet', () => {
  it('opens a starter’s card, and comes back to the lineup', () => {
    render(<App />)
    openScreen('nav.lineup')

    const starters = game().lineups[game().managedClubId]?.starters ?? []
    const first = squadOf().find((p) => starters.includes(p.id))
    if (first === undefined) throw new Error('nobody in the XI')

    // Nobody is selected, so no substitute buttons are rendered — this resolves
    // the starter's own row link and nothing else.
    fireEvent.click(screen.getByRole('button', { name: first.name }))
    expect(screen.getByRole('heading', { name: first.name })).toBeDefined()

    // The other half of the claim: closing returns you to the screen you pressed
    // on. An `inspectedFrom` fixed at 'squad' lands you somewhere else entirely.
    back()
    expect(screen.getByRole('heading', { name: t('lineup.startingXI') })).toBeDefined()
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

describe('the pitch', () => {
  const slots = (position?: string) => [
    ...document.querySelectorAll(
      position === undefined ? '.pitch__slot' : `.pitch__slot[data-position='${position}']`,
    ),
  ]

  const starterAt = (position: string) => {
    const ids = new Set(game().lineups[game().managedClubId]?.starters ?? [])
    const player = squadOf().find((p) => p.position === position && ids.has(p.id))
    if (player === undefined) throw new Error(`no ${position} in the XI`)
    return player
  }

  const label = (player: { position: string; name: string }) =>
    new RegExp(`${t(`position.${player.position}`)}.*${player.name}`)

  it('draws the shape that is on the pitch, in every formation', () => {
    render(<App />)
    openScreen('nav.lineup')

    for (const formation of FORMATION_NAMES) {
      fireEvent.click(screen.getByRole('button', { name: formation }))
      const shape = FORMATIONS[formation]

      expect(slots(), formation).toHaveLength(11)
      for (const position of ['GK', 'DF', 'MF', 'FW'] as const) {
        expect(slots(position).length, `${formation} ${position}`).toBe(shape[position])
      }
    }
    back()
  })

  it('reads the shape off the players, not off the lineup’s own label', () => {
    // `setLineup` now refuses an XI that does not match its label, but a save
    // from before it did can still hold one, so it is written straight into the
    // state rather than dispatched. A pitch that trusted the label would draw two
    // forwards here.
    render(<App />)
    const clubId = game().managedClubId
    const lineup = { formation: '4-4-2' as const, starters: bestXI(squadOf(), '4-3-3').starters }
    useGame.setState({ game: { ...game(), lineups: { ...game().lineups, [clubId]: lineup } } })
    openScreen('nav.lineup')

    expect(slots('FW')).toHaveLength(3)
    expect(slots('MF')).toHaveLength(3)
    back()
  })

  it('offers only same-position reserves, and names the man going off', () => {
    render(<App />)
    openScreen('nav.lineup')

    const out = starterAt('DF')
    fireEvent.click(screen.getByRole('button', { name: label(out) }))

    expect(screen.getByText(t('lineup.replacing', { name: out.name }))).toBeDefined()

    const ids = new Set(game().lineups[game().managedClubId]?.starters ?? [])
    const reserves = squadOf().filter((p) => p.position === 'DF' && !ids.has(p.id))
    expect(reserves.length).toBeGreaterThan(0)
    for (const sub of reserves) {
      expect(screen.getByRole('button', { name: new RegExp(sub.name) }), sub.name).toBeDefined()
    }
    // The guard on the guard: a keeper must not be offered for a defender.
    const keeper = squadOf().find((p) => p.position === 'GK' && !ids.has(p.id))
    if (keeper !== undefined) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${keeper.name}`) })).toBeNull()
    }
    back()
  })

  it('swaps the man, and only him', () => {
    render(<App />)
    openScreen('nav.lineup')

    const clubId = game().managedClubId
    const before = game().lineups[clubId]?.starters ?? []
    const out = starterAt('MF')
    fireEvent.click(screen.getByRole('button', { name: label(out) }))

    const sub = squadOf().find((p) => p.position === 'MF' && !before.includes(p.id))
    if (sub === undefined) throw new Error('no midfield reserve')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(sub.name) }))

    const after = game().lineups[clubId]?.starters ?? []
    expect(after).toHaveLength(11)
    expect(after).toContain(sub.id)
    expect(after).not.toContain(out.id)
    // In place: the man coming on takes the slot the man going off vacated, so
    // nobody else on the pitch moves.
    expect(after.filter((id, i) => id !== before[i])).toHaveLength(1)
    expect(after.indexOf(sub.id)).toBe(before.indexOf(out.id))
    back()
  })

  it('answers Enter and Space, and nothing else', () => {
    // A `<g role="button">` gets neither for free — only a real button does.
    render(<App />)
    openScreen('nav.lineup')
    const out = starterAt('FW')
    const slot = screen.getByRole('button', { name: label(out) })

    const replacing = () => screen.queryByText(t('lineup.replacing', { name: out.name }))

    fireEvent.keyDown(slot, { key: 'a' })
    expect(replacing()).toBeNull()

    fireEvent.keyDown(slot, { key: 'Enter' })
    expect(replacing()).not.toBeNull()

    fireEvent.keyDown(slot, { key: ' ' })
    expect(replacing()).toBeNull()
    back()
  })

  it('lets go of a selection the XI no longer contains', () => {
    // The `NegotiationPanel` defect in a new costume: a target resolved against
    // the squad rather than the live XI keeps the last man's name on screen.
    render(<App />)
    openScreen('nav.lineup')

    const clubId = game().managedClubId
    const out = starterAt('DF')
    fireEvent.click(screen.getByRole('button', { name: label(out) }))
    expect(screen.getByText(t('lineup.replacing', { name: out.name }))).toBeDefined()

    const kept = (game().lineups[clubId]?.starters ?? []).filter((id) => id !== out.id)
    const sub = squadOf().find(
      (p) => p.position === 'DF' && !kept.includes(p.id) && p.id !== out.id,
    )
    if (sub === undefined) throw new Error('no defensive reserve')
    // `act` because this is a store write from outside React, standing in for
    // the reducer's own re-pick after a sale. Without it the assertion below
    // reads a stale render and passes for the wrong reason.
    act(() => {
      useGame.getState().dispatch({
        type: 'SetLineup',
        clubId,
        lineup: { formation: '4-4-2', starters: [...kept, sub.id] },
      })
    })

    expect(screen.queryByText(t('lineup.replacing', { name: out.name }))).toBeNull()
    back()
  })

  it('lists the whole bench until somebody is picked', () => {
    // The panel is titled Suplents and is always on screen, so idle it says who
    // is available rather than holding a sentence asking you to press something.
    render(<App />)
    openScreen('nav.lineup')

    const ids = new Set(game().lineups[game().managedClubId]?.starters ?? [])
    const reserves = squadOf().filter((p) => !ids.has(p.id))
    const bench = () => document.querySelectorAll('.lineup-screen__sub')

    expect(reserves.length).toBeGreaterThan(0)
    expect(bench()).toHaveLength(reserves.length)
    // Idle rows are not controls — there is nobody to swap them for yet.
    expect(document.querySelectorAll('button.lineup-screen__sub')).toHaveLength(0)

    const out = starterAt('DF')
    fireEvent.click(screen.getByRole('button', { name: label(out) }))

    const defenders = reserves.filter((p) => p.position === 'DF')
    // The narrowing has to be a real narrowing, or this proves nothing.
    expect(defenders.length).toBeLessThan(reserves.length)
    expect(bench()).toHaveLength(defenders.length)
    expect(document.querySelectorAll('button.lineup-screen__sub')).toHaveLength(defenders.length)
    back()
  })
})
