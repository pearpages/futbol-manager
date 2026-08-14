import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ATTRIBUTE_KEYS, type Player } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'

/**
 * The ficha — the radar, the comparison, and the block that says what any of the
 * numbers actually do.
 *
 * Every assertion here is one a screenshot could not make: that the second shape
 * is the compared player's rather than a copy of the first, that a comparison does
 * not follow you onto the next card, and that the percentages are read off the
 * model instead of typed into a dictionary.
 */

const MID = DEFAULT_CLUBS[13]?.id ?? ''

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const squad = () => {
  const state = useGame.getState().game
  return state.squads[state.managedClubId] ?? []
}

const at = (position: Player['position'], skip = 0) => {
  const player = squad().filter((p) => p.position === position)[skip]
  if (player === undefined) throw new Error(`no ${position} at ${String(skip)}`)
  return player
}

/** Opens a player's card the way a manager does — through the squad list. */
function openFicha(player: Player) {
  render(<App />)
  openScreen('nav.squad')
  fireEvent.click(screen.getByText(player.name))
}

/** Back to the list and into someone else's card, which is the only route there. */
function openAnother(player: Player) {
  back()
  fireEvent.click(screen.getByText(player.name))
}

const polygons = () => document.querySelectorAll('.radar__area')
const comparePolygon = () => document.querySelector('.radar__area.is-compare')
const compareSelect = () => screen.getByLabelText(/Compare with/i)
const deltas = () => [...document.querySelectorAll('.attr__delta')].map((el) => el.textContent)

describe('the radar', () => {
  it('draws one shape with an axis per attribute', () => {
    const player = at('MF')
    openFicha(player)

    expect(polygons()).toHaveLength(1)
    expect(comparePolygon()).toBeNull()
    // Short forms, because eight full names do not fit an octagon.
    expect(document.querySelectorAll('.radar__label')).toHaveLength(ATTRIBUTE_KEYS.length)
    expect(screen.getByRole('img', { name: new RegExp(player.name) })).toBeTruthy()
  })

  it('plots the player rather than a fixed shape', () => {
    // A radar that ignored its input would look perfectly fine. This is the only
    // assertion that catches it.
    openFicha(at('FW'))
    const forward = document.querySelector('.radar__area')?.getAttribute('points')

    openAnother(at('GK'))
    const keeper = document.querySelector('.radar__area')?.getAttribute('points')

    expect(forward).not.toBe(keeper)
  })
})

describe('comparing two players', () => {
  it('lays a second shape over the first, with their numbers and the difference', () => {
    const subject = at('MF')
    const other = at('MF', 1)
    openFicha(subject)

    fireEvent.change(compareSelect(), { target: { value: other.id } })

    expect(polygons()).toHaveLength(2)
    expect(comparePolygon()).toBeTruthy()

    const expected = ATTRIBUTE_KEYS.map((key) => {
      const difference = subject.attributes[key] - other.attributes[key]
      return difference > 0 ? `+${String(difference)}` : String(difference)
    })
    expect(deltas()).toEqual(expected)

    // Both men's numbers are on the row, not just the subject's.
    const theirs = [...document.querySelectorAll('.attr__value.is-b')].map((el) => el.textContent)
    expect(theirs).toEqual(ATTRIBUTE_KEYS.map((key) => String(other.attributes[key])))
  })

  it('names both shapes in the key', () => {
    const subject = at('DF')
    const other = at('DF', 1)
    openFicha(subject)
    fireEvent.change(compareSelect(), { target: { value: other.id } })

    const key = document.querySelector('.radar-key')
    expect(key?.textContent).toContain(subject.name)
    expect(key?.textContent).toContain(other.name)
  })

  it('clears back to one shape', () => {
    const subject = at('MF')
    openFicha(subject)
    fireEvent.change(compareSelect(), { target: { value: at('MF', 1).id } })
    fireEvent.change(compareSelect(), { target: { value: '' } })

    expect(polygons()).toHaveLength(1)
    expect(deltas()).toEqual([])
  })

  it('never offers the player against himself', () => {
    const subject = at('FW')
    openFicha(subject)

    const options = [...compareSelect().querySelectorAll('option')].map((o) => o.textContent ?? '')
    expect(options.some((text) => text.includes(subject.name))).toBe(false)
    expect(options.length).toBe(squad().length) // the rest of the squad, plus "Nobody"
  })

  it('does not follow you onto the next card', () => {
    // A comparison belongs to the card it was set on. Carried over, it silently
    // shows you the wrong man's numbers beside the right man's.
    const subject = at('MF')
    openFicha(subject)
    fireEvent.change(compareSelect(), { target: { value: at('MF', 1).id } })
    expect(comparePolygon()).toBeTruthy()

    openAnother(at('DF'))

    expect(comparePolygon()).toBeNull()
    expect(useGame.getState().comparedPlayerId).toBeNull()
  })

  it('is dropped by opening a card directly, not only by closing one', () => {
    // The UI has no ficha-to-ficha link yet, so the route above goes out through
    // `inspect(null)` and would pass even if opening a card kept the comparison.
    // This drives the door the first such link will use.
    const store = useGame.getState()
    store.inspect(at('MF').id)
    store.compare(at('MF', 1).id)
    store.inspect(at('DF').id)

    expect(useGame.getState().comparedPlayerId).toBeNull()
  })
})

describe('what the numbers do', () => {
  const model = () => document.querySelector('.ficha__model')?.textContent ?? ''

  it('reads the weights off the model rather than restating them', () => {
    // If anyone types a percentage into a dictionary, these are the numbers that
    // stop matching POSITION_WEIGHTS.
    openFicha(at('GK'))

    expect(model()).toContain('Keeping')
    expect(model()).toContain('70%')
    // A keeper's finishing is worth exactly nothing, which is the single most
    // useful thing this block says.
    expect(model()).toMatch(/Counts for nothing here:[^.]*Finishing/)
    expect(model()).toContain('A goalkeeper adds nothing to the attack.')
  })

  it('does not follow a "counts for nothing" sentence with all eight attributes', () => {
    // A keeper's attack group is one sentence saying he adds nothing. Listing every
    // attribute underneath it says the same thing again, at length.
    openFicha(at('GK'))
    const groups = [...document.querySelectorAll('.model-group')]
    const attack = groups.find((g) => g.textContent?.includes('adds nothing to the attack'))

    expect(attack?.querySelector('.model-group__unused')).toBeNull()
  })

  it('states one keeper carries 35% of the defence', () => {
    openFicha(at('GK'))
    expect(model()).toContain('35%')
    expect(model()).toContain('more than any other single player')
  })

  it('gives an outfielder his own share of both team numbers', () => {
    openFicha(at('FW'))
    // 4-4-2: one forward owns 1/4.4 of the attack and 0.65×0.15/6.3 of the defence.
    expect(model()).toContain('22.7%')
    expect(model()).toContain('1.5%')
    expect(model()).toContain('4-4-2')
  })

  it('says what a rating edge is worth in goals', () => {
    openFicha(at('MF'))
    // exp(SLOPE × 10 / SCALE) − 1 ≈ 27%, asked of the resolver rather than quoted.
    expect(model()).toMatch(/10 rating points of advantage is worth about 27% more of them/)
  })
})
