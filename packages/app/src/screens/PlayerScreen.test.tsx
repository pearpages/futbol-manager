import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { askingPrice, ATTRIBUTE_KEYS, type Player, reluctancePremium } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'
import { listingsFor } from './MarketScreen.tsx'
import { translatorFor } from '../i18n/useT.ts'

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

/**
 * Somebody else's player, reached the way a manager reaches one — through the
 * market table. The card is the same card; what differs is what it may claim.
 */
function openListedFicha() {
  render(<App />)
  // A seller in the league: which club comes first in the market moves with the
  // squads, and a club abroad is not in `game.clubs`.
  const { game } = useGame.getState()
  const listing = listingsFor(game).find(
    (l) => l.from !== null && game.clubs.some((c) => c.id === l.from),
  )
  if (listing === undefined) throw new Error('nothing listed by another club')
  openScreen('nav.market')
  fireEvent.click(screen.getByRole('button', { name: listing.player.name }))
  return listing
}

const identity = () => {
  const el = document.querySelector('.ficha__identity')
  if (el === null) throw new Error('no identity block')
  return el as HTMLElement
}

const radarKey = () => {
  const el = document.querySelector('.radar-key')
  if (el === null) throw new Error('no radar key')
  return el as HTMLElement
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
    // The route above goes out through `inspect(null)` and would pass even if
    // opening a card kept the comparison. The key's link is now a UI route that
    // does not — see 'one card to the next' below — but this holds the store to
    // the contract independently of any screen.
    const store = useGame.getState()
    store.inspect(at('MF').id)
    store.compare(at('MF', 1).id)
    store.inspect(at('DF').id)

    expect(useGame.getState().comparedPlayerId).toBeNull()
  })
})

describe('one card to the next', () => {
  /** Subject, compared man, and the key showing both. */
  function comparing() {
    const subject = at('MF')
    const other = at('MF', 1)
    openFicha(subject)
    fireEvent.change(compareSelect(), { target: { value: other.id } })
    return { subject, other }
  }

  it('opens the compared man from the key', () => {
    const { other } = comparing()

    fireEvent.click(within(radarKey()).getByRole('button', { name: other.name }))

    expect(screen.getByRole('heading', { name: other.name })).toBeDefined()
    expect(useGame.getState().inspectedPlayerId).toBe(other.id)
  })

  it('offers no route back to the card you are already on', () => {
    const { subject } = comparing()

    // Linking both names is the symmetric-looking mistake: `inspect` clears the
    // comparison on every open, so the subject's own name would silently destroy
    // the very thing the key is explaining.
    expect(within(radarKey()).getAllByRole('button')).toHaveLength(1)
    expect(within(radarKey()).queryByRole('button', { name: subject.name })).toBeNull()
  })

  it('comes back to the list you started from, not the card you came through', () => {
    // The first exercise of the `inspectedFrom` guard in the store, which has
    // been written and unreachable since M4b. Without it, back lands on a card
    // with no player and the ficha renders its empty state.
    const { other } = comparing()
    fireEvent.click(within(radarKey()).getByRole('button', { name: other.name }))

    back()

    expect(useGame.getState().screen).toBe('squad')
    expect(useGame.getState().screen).toBe('squad')
  })

  it('drops the comparison on the way', () => {
    const { other } = comparing()
    fireEvent.click(within(radarKey()).getByRole('button', { name: other.name }))

    // The assertion has to be on the store. The rendered consequence is invisible
    // for this particular link — the target *is* the compared man, and the screen
    // already refuses to compare anyone against himself.
    expect(useGame.getState().comparedPlayerId).toBeNull()
  })
})

describe('whose player this is', () => {
  it('says which club he plays for', () => {
    const listing = openListedFicha()
    const club = useGame.getState().game.clubs.find((c) => c.id === listing.from)
    if (club === undefined) throw new Error('no seller')

    expect(within(identity()).getByRole('img', { name: club.name })).toBeDefined()
  })

  it('says so when nobody owns him', () => {
    // Season one has no pool — free agents accumulate at each rollover — so one
    // is planted rather than playing a year to reach the branch.
    const state = useGame.getState().game
    const rival = state.clubs.find((c) => c.id !== state.managedClubId)
    if (rival === undefined) throw new Error('no rival')
    const [released, ...rest] = state.squads[rival.id] ?? []
    if (released === undefined) throw new Error('empty squad')
    useGame.setState({
      game: { ...state, squads: { ...state.squads, [rival.id]: rest }, freeAgents: [released] },
    })

    render(<App />)
    openScreen('nav.market')
    // The listings page now, and the shuffle can put him anywhere. Narrowing to
    // free agents is both what reaches him in one press and what a manager looking
    // for one would actually do.
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }))
    fireEvent.click(screen.getByRole('button', { name: released.name }))

    expect(within(identity()).getByText('Free agent')).toBeDefined()
  })

  it('does not tell you to pick a rival for your own XI', () => {
    // It used to: the line reads off *your* team sheet whoever the card is for,
    // so a man at another club was told "On the bench. Change the lineup to start
    // them" — false, and an instruction you cannot follow.
    openListedFicha()

    expect(document.querySelector('.ficha__status')).toBeNull()
  })

  it('still says where one of your own stands', () => {
    // The pair is the constraint. Hiding the line for everybody would satisfy the
    // test above on its own.
    openFicha(at('MF'))

    expect(document.querySelector('.ficha__status')?.textContent).toMatch(/starting XI|bench/)
  })
})

describe('renewing from the card', () => {
  const { t } = translatorFor('en')

  it('offers a renewal for one of your own', () => {
    openFicha(at('MF'))
    expect(screen.getByRole('button', { name: t('squad.renew') })).toBeDefined()
  })

  it('offers nothing for a rival, because you cannot renew him', () => {
    // The pair is the constraint. Hiding the button for everybody would satisfy
    // the test above on its own.
    openListedFicha()
    expect(screen.queryByRole('button', { name: t('squad.renew') })).toBeNull()
  })

  it('opens the same dialog the squad screen uses', () => {
    const player = at('MF')
    openFicha(player)
    fireEvent.click(screen.getByRole('button', { name: t('squad.renew') }))

    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('heading', { name: t('renew.title', { player: player.name }) }),
    ).toBeDefined()
  })
})

describe('bidding from the card', () => {
  const { t } = translatorFor('en')

  it('offers a bid for a rival — the card is the route to everyone else', () => {
    // `MakeBid` used to be reachable only from a market listing, which is a
    // club's `surplus`. So the only players you could bid for were the ones
    // their club had already given up on.
    openListedFicha()
    expect(screen.getByRole('button', { name: t('player.bid') })).toBeDefined()
  })

  it('offers nothing for one of your own', () => {
    // The pair is the constraint: hiding the button for everybody would satisfy
    // the test above on its own.
    openFicha(at('MF'))
    expect(screen.queryByRole('button', { name: t('player.bid') })).toBeNull()
  })

  // **The premium half of this claim is asserted in `MarketScreen.test.tsx`, not
  // here.** Every route onto a rival's card from *this* file goes through a market
  // listing, and a listing is by definition a player his club will sell — so the
  // premium is exactly 1 and the adjusted price is the bare price. Mutating the
  // prefill to drop the premium failed the club-browser test and not this one.
  it('opens on what his club would take, and names him in the heading', () => {
    const listing = openListedFicha()
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))

    const dialog = within(screen.getByRole('dialog'))
    expect(
      dialog.getByRole('heading', { name: t('bid.title', { player: listing.player.name }) }),
    ).toBeDefined()

    const game = useGame.getState().game
    const squad = listing.from === null ? [] : (game.squads[listing.from] ?? [])
    const wanted = Math.round(
      askingPrice(listing.player, game.season.currentDate) *
        reluctancePremium(squad, listing.player),
    )
    expect((dialog.getByLabelText(/Fee/i) as HTMLInputElement).value).toBe(String(wanted))
  })

  it('says a club would sell, or that it would rather not', () => {
    // A listing is by definition somebody the club will sell, so this is the
    // willing half; the reluctant half is the one that needs a starter, which
    // no listing is.
    const listing = openListedFicha()
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))

    const club = DEFAULT_CLUBS.find((c) => c.id === listing.from)?.name ?? ''
    expect(within(screen.getByRole('dialog')).getByText(t('bid.willing', { club }))).toBeDefined()
  })

  it('stays open when the bid is refused', () => {
    // A dialog that always closes is indistinguishable from one that did
    // nothing — the defect the renewal dialog shipped with. Ninety-nine
    // million is past any club's overdraft.
    openListedFicha()
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))

    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText(/Fee/i), { target: { value: '99999999' } })
    fireEvent.click(dialog.getByRole('button', { name: t('market.makeBid') }))

    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toMatch(/overdraft/i)
  })

  it('closes when the bid is actually made', () => {
    const listing = openListedFicha()
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('market.makeBid') }),
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useGame.getState().game.bids.some((bid) => bid.playerId === listing.player.id)).toBe(
      true,
    )
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
    // exp(SLOPE × 5 / SCALE) − 1 ≈ 27%, asked of the resolver rather than quoted.
    // Six points on the 60–94 scale is what ten was on the old 1–99 one.
    expect(model()).toMatch(/5 rating points of advantage is worth about 27% more of them/)
  })
})
