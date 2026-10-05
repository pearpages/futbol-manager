import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ClubId } from '@fm/domain'
import {
  askingPrice,
  COUNTRIES,
  overall,
  bidIsLive,
  canAfford,
  FINANCE,
  fromCivil,
  isTransferWindowOpen,
  MIN_SQUAD,
  aiSaleRefusal,
  needFor,
  ROUNDS_PER_HALF,
  signingOutlay,
  suggestedTerms,
  FOREIGN_LISTINGS,
  surplus,
} from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { ADVANCE, advance, advanceUntil, back, openScreen, confirm } from '../testing.ts'
import { translatorFor } from '../i18n/useT.ts'
import { listingsFor, listingValue, marketSeed, scoutedPrice } from './MarketScreen.tsx'

/**
 * The market screen, driving the real store and the real reducer.
 *
 * Everything asserted here is deterministic. The claim that a signing changes
 * your *results* is statistical and belongs to the domain harness over twenty
 * seasons — a UI test that compared two single seasons would be measuring luck,
 * which this project has already been caught doing once.
 */

/** Madrid: rich enough that the affordability rules are not what is under test. */
const RICH = DEFAULT_CLUBS[0]?.id
if (RICH === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(RICH)
})

const game = () => useGame.getState().game

function openMarket() {
  render(<App />)
  openScreen('nav.market')
}

const bodyRows = () => [...document.querySelectorAll('.market-screen__main tbody tr')]

/** Names in the order the table shows them. */
const rowNames = () => bodyRows().map((r) => r.querySelector('.player-link')?.textContent ?? '')

/** Asking prices as numbers, for order assertions. `Free` sorts as zero. */
const rowFees = () =>
  bodyRows().map((r) => {
    const text = r.querySelectorAll('td')[6]?.textContent?.trim() ?? ''
    if (text === 'Free') return 0
    const value = Number(text.replace(/[€kM]/g, ''))
    return text.endsWith('M') ? value * 1000 : value
  })

/**
 * The pager, once the listings run past a page. Absent when they do not, which is
 * what `step` returning false on a missing control means.
 */
const step = (label: string) => {
  const pager = document.querySelector('.market-screen__pager')
  if (pager === null) return false
  const button = within(pager as HTMLElement).getByRole('button', {
    name: label,
  }) as HTMLButtonElement
  if (button.disabled) return false
  fireEvent.click(button)
  return true
}
const nextPage = () => step('Next page')
const prevPage = () => step('Previous page')

/**
 * A bound on every paging loop, and it is not belt-and-braces.
 *
 * A pager whose `atStart`/`atEnd` is wrong never disables its buttons, so a
 * `while (nextPage())` runs forever — a mutation sweep found exactly that and both
 * arms sat there until the runner was killed, which reads as a hung machine rather
 * than as a broken bound. Same guard, and the same reasoning, as `advanceUntil`.
 */
const PAGE_LIMIT = 40

function pageThrough(go: () => boolean, each: () => void) {
  for (let i = 0; i < PAGE_LIMIT; i++) {
    if (!go()) return
    each()
  }
  throw new Error(`the pager stepped ${PAGE_LIMIT} times without reaching an end`)
}

const toFirstPage = () => {
  pageThrough(prevPage, () => {})
}

const toLastPage = () => {
  pageThrough(nextPage, () => {})
}

/**
 * Every name on every page.
 *
 * **This is what "reachable" means now, and it is a stronger claim than counting
 * `<tr>` elements.** The M4b defect was a bare `.slice(0, 60)` that hid ~90
 * affordable signings from a weak club; the guard against it returning is that
 * paging to the end finds everybody, not that everybody is in the DOM at once.
 *
 * Leaves the table on the first page, so it is safe to call mid-test.
 */
const allRowNames = () => {
  toFirstPage()
  const names = new Set(rowNames())
  pageThrough(nextPage, () => {
    for (const name of rowNames()) names.add(name)
  })
  toFirstPage()
  return names
}

/** Pages from the top until the row shows up, and stops there. */
function goToRow(name: string): HTMLElement {
  toFirstPage()
  for (let i = 0; i <= PAGE_LIMIT; i++) {
    const found = bodyRows().find((r) => r.querySelector('.player-link')?.textContent === name)
    if (found !== undefined) return found as HTMLElement
    if (!nextPage()) break
  }
  throw new Error(`${name} is on no page`)
}

/** The row for the first player in market order. */
function firstListingRow() {
  const listings = listingsFor(game())
  const target = listings[0]
  if (target === undefined) throw new Error('nothing on the market')
  const row = screen.getByText(target.player.name).closest('tr')
  if (row === null) throw new Error('no row for the target')
  return { target, row }
}

describe('the market screen', () => {
  it('is reachable from the shell', () => {
    openMarket()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })

  it('shows the budget in money, not raw thousands', () => {
    openMarket()
    // The domain deals in thousands; a screen that printed them raw would be read
    // wrong every time.
    expect(screen.getByText('Budget')).toBeDefined()
    expect(document.body.textContent).toMatch(/€[\d.]+[kM]/)
  })

  it('lists only players another club has actually put up for sale', () => {
    openMarket()
    const state = game()
    // Abroad counts: a club there offers `FOREIGN_LISTINGS` of its fringe.
    const listed = new Set([
      ...state.competition.clubIds
        .filter((id) => id !== state.managedClubId)
        .flatMap((id) => surplus(state.squads[id] ?? []).map((p) => p.name)),
      ...state.foreign.clubs.flatMap((club) =>
        surplus(state.foreign.squads[club.id] ?? [])
          .slice(0, FOREIGN_LISTINGS)
          .map((p) => p.name),
      ),
    ])

    // Your own players are never on the market, and neither is anyone's starter.
    for (const own of state.squads[state.managedClubId] ?? []) {
      expect(screen.queryByText(own.name)).toBeNull()
    }
    const { target } = firstListingRow()
    expect(listed.has(target.player.name)).toBe(true)
  })

  it('makes a bid that lands in game state', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    const bid = game().bids.find((b) => b.playerId === target.player.id)
    expect(bid).toBeDefined()
    expect(bid?.from).toBe(game().managedClubId)
    expect(bid?.fee).toBe(askingPrice(target.player, game().season.currentDate))
  })

  it('shows a refusal instead of crashing', () => {
    openMarket()
    const { row } = firstListingRow()
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))

    const fee = screen.getByLabelText(/^Fee/)
    fireEvent.change(fee, { target: { value: '99999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    expect(screen.getByRole('alert').textContent).toMatch(/overdraft limit/)
    expect(game().bids).toHaveLength(0)
  })

  it('completes a signing once the fee and the terms are both agreed', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))

    // Wait somewhere other than the market, which is what a manager does and
    // what keeps this test honest about cost: the full listing is a few hundred
    // rows, and re-rendering it on every tick measures the table rather than the
    // bid.
    back()

    // The answer arrives with the clock, which is why bids are saved state.
    for (let day = 0; day < 5 && game().bids.some((b) => b.status === 'pending'); day++) {
      advance()
    }
    expect(game().bids[0]?.status).toBe('accepted')

    // Coming back, the negotiation panel is closed — leaving the screen drops it.
    // "Your bids" is how you pick the deal back up, which is the point of that
    // panel existing.
    openScreen('nav.market')
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Offer terms' }))
    confirm()

    const squad = game().squads[game().managedClubId] ?? []
    expect(squad.some((p) => p.id === target.player.id)).toBe(true)
    // Only our own bids. Since M4c the clock also brings in offers for our players,
    // so `bids` runs in both directions.
    expect(
      game()
        .bids.filter((b) => b.from === RICH)
        .filter(bidIsLive),
    ).toHaveLength(0)
  })

  it('keeps a shortlist that survives navigation', () => {
    openMarket()
    const { target, row } = firstListingRow()

    fireEvent.click(within(row).getByRole('button', { name: 'Watch' }))
    expect(game().shortlist).toEqual([target.player.id])

    back()
    openScreen('nav.table')
    back()
    openScreen('nav.market')
    fireEvent.click(screen.getByRole('button', { name: 'Shortlist only' }))

    expect(screen.getByText(target.player.name)).toBeDefined()
  })

  it('opens the ficha for a player you do not own, and comes back', () => {
    openMarket()
    const { target } = firstListingRow()

    fireEvent.click(screen.getByRole('button', { name: target.player.name }))
    expect(screen.getByRole('heading', { name: target.player.name })).toBeDefined()

    // Closing used to always return to the squad, which loses your place here.
    back()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })

  it('opens the ficha for a man you have put up for sale', () => {
    // The rail names players in three panels and the table names them once. Only
    // the table used to be a way in, so you could be shown a man's asking price
    // with no route to what you were selling.
    const spare = surplus(game().squads[game().managedClubId] ?? [])[0]
    if (spare === undefined) throw new Error('nobody spare')

    render(<App />)
    openScreen('nav.squad')
    const row = screen.getByText(spare.name).closest('tr')
    if (row === null) throw new Error('no squad row')
    fireEvent.click(within(row).getByRole('button', { name: 'List' }))
    back()
    openScreen('nav.market')

    const panel = screen.getByRole('heading', { name: 'Up for sale' }).closest('section')
    if (panel === null) throw new Error('no panel')
    fireEvent.click(within(panel).getByRole('button', { name: spare.name }))

    expect(screen.getByRole('heading', { name: spare.name })).toBeDefined()
    back()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })
})

describe('reaching the whole market', () => {
  /**
   * Until now the screen sliced the list to sixty rows with no filter, no sort and
   * no pager, so the rest were simply unreachable. Worse than incomplete: the sort
   * is by how much a player improves your XI, and the biggest improvements are the
   * most expensive, so a weak club saw sixty players it could not afford while the
   * ninety-odd useful signings inside its budget sat below the cut.
   */
  const allListings = () => listingsFor(game())

  it('reaches every listing by paging, and never hides the total', () => {
    openMarket()
    const total = allListings().length
    expect(total).toBeGreaterThan(60)

    // Bounded, not capped. The page is a slice; the count line names the whole
    // market either way, which is the affordance the sixty-row cap lacked.
    expect(bodyRows().length).toBeLessThan(total)
    expect(screen.getByText(`Showing ${total} of ${total}`)).toBeDefined()

    expect(allRowNames().size).toBe(total)
  })

  it('comes back to the first page, so paging is not a one-way door', () => {
    openMarket()
    const firstPage = rowNames()

    expect(nextPage()).toBe(true)
    expect(rowNames()).not.toEqual(firstPage)

    expect(prevPage()).toBe(true)
    expect(rowNames()).toEqual(firstPage)
    // And the near end really is an end.
    expect(prevPage()).toBe(false)
  })

  it('drops you back to the first page when a filter changes what is in the list', () => {
    openMarket()
    expect(nextPage()).toBe(true)
    expect(nextPage()).toBe(true)
    expect(screen.getByText('Page 3 of 8')).toBeDefined()

    // **Madrid can afford the whole league**, so this filter removes nobody and the
    // page count does not move — which is what makes it a test of the reset rather
    // than of the clamp. A filter that shortened the list would be satisfied by
    // either.
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))
    expect(screen.getByText('Page 1 of 8')).toBeDefined()
  })

  it('keeps the page label out of the buttons, so reading it cannot page you', () => {
    // A structural assertion because the consequence is invisible here: jsdom does
    // no layout, and the buttons carry an `aria-label`, which overrides their
    // contents — so folding the label inside one changes neither the accessible
    // name nor anything a query can see. What it *does* change is the click target.
    openMarket()
    expect(screen.getByText(/^Page 1 of/).closest('button')).toBeNull()
  })

  it('sorting drops you back too, since it reorders the whole market', () => {
    // Page four of a list you have never seen the top of is not a useful place to
    // land after asking for the dearest players.
    openMarket()
    expect(nextPage()).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /^Asking/ }))
    expect(screen.getByText('Page 1 of 8')).toBeDefined()
  })

  /**
   * Defence in depth, and the test says so.
   *
   * No control can reach this today — every one of them resets the page — and the
   * listings hold steady at 290 across a month of ticks, so the list does not shrink
   * underneath a reader either. The clamp is here for the state *arriving* short,
   * which is why this stages it directly rather than trying to click into it. Same
   * shape as the rollover's `canField` guard.
   */
  it('never shows a page that has stopped existing', () => {
    openMarket()
    toLastPage()
    expect(screen.getByText('Page 8 of 8')).toBeDefined()

    const state = game()
    const keep = new Set([state.managedClubId, state.competition.clubIds[1]])
    act(() => {
      useGame.setState({
        game: {
          ...state,
          squads: Object.fromEntries(
            Object.entries(state.squads).filter(([id]) => keep.has(id as ClubId)),
          ),
          foreign: { ...state.foreign, squads: {} },
        },
      })
    })

    // Back to the only page there is — and with one page the control disappears
    // rather than sitting there with both arrows dead. Without the clamp this is
    // `slice(280, 320)` of a much shorter list, which renders nothing at all.
    const left = listingsFor(game()).length
    expect(left).toBeGreaterThan(0)
    expect(bodyRows()).toHaveLength(left)
    expect(document.querySelector('.market-screen__pager')).toBeNull()
  })

  it('names the position filters in the language you are in', () => {
    // These were the raw domain enum, so in Catalan the four filter buttons read
    // GK/DF/MF/FW directly above a Pos column reading POR/DEF/MIG/DAV.
    const catalan = translatorFor('ca')
    useGame.setState({ language: 'ca' })
    openMarket()

    for (const position of ['GK', 'DF', 'MF', 'FW']) {
      expect(
        screen.getAllByRole('button', { name: catalan.t(`position.${position}`) }).length,
      ).toBeGreaterThan(0)
    }
    expect(screen.queryByRole('button', { name: 'MF' })).toBeNull()

    useGame.setState({ language: 'en' })
  })

  it('filters to a position', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'GK' }))

    const keepers = allListings().filter((l) => l.player.position === 'GK')
    expect(keepers.length).toBeGreaterThan(0)
    expect(allRowNames().size).toBe(keepers.length)
    for (const row of bodyRows()) {
      expect(within(row as HTMLElement).getByText('GK')).toBeDefined()
    }
  })

  it('combines positions rather than replacing them', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'GK' }))
    fireEvent.click(screen.getByRole('button', { name: 'FW' }))

    const both = allListings().filter(
      (l) => l.player.position === 'GK' || l.player.position === 'FW',
    )
    expect(allRowNames().size).toBe(both.length)
  })

  it('filters to what you can pay for', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))

    const budget = game().clubs.find((c) => c.id === game().managedClubId)?.budget ?? 0
    const affordable = allListings().filter((l) => l.fee <= budget)
    expect(allRowNames().size).toBe(affordable.length)
  })

  it('filters to free agents', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }))
    // A fresh league has an empty pool — nobody is out of contract until the first
    // rollover — so this correctly shows nothing rather than everything.
    expect(allRowNames().size).toBe(allListings().filter((l) => l.from === null).length)
  })

  it('says so when the filters exclude everybody', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Free agents' }))
    expect(screen.getByText('Nobody matches those filters.')).toBeDefined()
  })
})

describe('the market does not do your scouting', () => {
  /**
   * The screen used to carry an "Improves" column — `needFor`, rendered — which
   * told you outright which signing would strengthen your team. That turned the
   * market into a lookup. The number still drives the AI, and is documented in
   * docs/market-model.md; it is simply not shown, and the list is shuffled so the
   * best players are not conveniently at the top either.
   */
  it('shows no improvement score anywhere', () => {
    openMarket()
    expect(screen.queryByText('Improves')).toBeNull()
    // Nothing of the form "+6.0" survives in the table.
    expect(document.querySelector('.market-screen__main')?.textContent).not.toMatch(/\+\d+\.\d/)
  })

  it('does not order the list by quality, price or age', () => {
    openMarket()
    const overalls = bodyRows().map((r) => Number(r.querySelectorAll('td')[4]?.textContent))
    const fees = rowFees()
    const ages = bodyRows().map((r) => Number(r.querySelectorAll('td')[3]?.textContent))

    const sorted = (v: number[]) =>
      v.every((n, i) => i === 0 || n <= (v[i - 1] ?? 0)) ||
      v.every((n, i) => i === 0 || n >= (v[i - 1] ?? 0))

    expect(sorted(overalls)).toBe(false)
    expect(sorted(fees)).toBe(false)
    expect(sorted(ages)).toBe(false)
  })

  it('holds the same order across navigation, rather than reshuffling', () => {
    // A list that moved every render would be unusable.
    openMarket()
    const first = rowNames()

    back()
    openScreen('nav.table')
    back()
    openScreen('nav.market')

    expect(rowNames()).toEqual(first)
  })

  it('deals a different market for the January window', () => {
    const august = game().season.currentDate
    const january = fromCivil(2027, 1, 10)
    expect(marketSeed(august, game().managedClubId)).not.toBe(
      marketSeed(january, game().managedClubId),
    )
    // …and holds still within a window: mid-September belongs to August's.
    expect(marketSeed(fromCivil(2026, 9, 20), game().managedClubId)).toBe(
      marketSeed(august, game().managedClubId),
    )
  })

  it('deals a different market to each club', () => {
    const date = game().season.currentDate
    const other = DEFAULT_CLUBS[5]?.id
    if (other === undefined) throw new Error('no clubs')
    expect(marketSeed(date, RICH)).not.toBe(marketSeed(date, other))
  })
})

describe('the club browser', () => {
  const { t } = translatorFor('en')

  const openClubs = () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: t('market.tab.clubs') }))
  }

  /** The tab lands on the grid; every test below wants a club open. */
  const browse = (clubId: string) => {
    openClubs()
    const club = [...game().clubs, ...game().foreign.clubs].find((c) => c.id === clubId)
    if (club === undefined) throw new Error(`no club ${clubId}`)
    fireEvent.click(screen.getByRole('button', { name: club.name }))
  }

  const aRival = () => game().clubs.find((c) => c.id !== RICH)?.id ?? ''
  const tiles = () => [...document.querySelectorAll('.club-grid__club')]
  /**
   * The tile's *label*, not its `textContent` — the badge is an inline SVG whose
   * `<text>` carries the three-letter code, so `textContent` reads "MADMadrid"
   * and a `not.toContain(name)` over it passes for the wrong reason. The
   * accessible name is unaffected, because the badge is `aria-hidden`.
   */
  const tileNames = () =>
    tiles().map((el) => el.querySelector('.club-grid__name')?.textContent ?? '')

  it('shows a rival’s whole squad, not only what he has given up on', () => {
    // The point of the tab. `listingsFor` is each club's `surplus`, so before
    // this the screen could only ever show you the players a club had already
    // decided to sell — and the reducer now takes a bid for anyone.
    const clubId = aRival()
    browse(clubId)
    const squad = game().squads[clubId] ?? []
    const listed = surplus(squad)

    expect(bodyRows()).toHaveLength(squad.length)
    expect(squad.length).toBeGreaterThan(listed.length)
  })

  it('never shows your own club — you cannot bid for your own players', () => {
    openClubs()
    const names = tileNames()
    const mine = game().clubs.find((c) => c.id === RICH)?.name
    expect(names).not.toContain(mine)
    // Everyone but you, at home and abroad.
    expect(names.length).toBe(game().clubs.length - 1 + game().foreign.clubs.length)
  })

  it('groups the crests by country, home first', () => {
    openClubs()
    const headings = [...document.querySelectorAll('.club-grid__country')].map(
      (el) => el.textContent,
    )
    expect(headings[0]).toBe(t('market.atHome'))
    for (const country of COUNTRIES) expect(headings).toContain(t(`country.${country}`))
    // One per place, and no empty group rendered for a country with no clubs.
    expect(headings).toHaveLength(1 + COUNTRIES.length)
  })

  it('measures the squads abroad against the whole game, not just against each other', () => {
    // **A wiring claim, and it has to be asserted here.** The band in
    // `foreign-rosters.test.ts` builds its own pooled norm, so it says the *data*
    // works under one — it cannot see whether the app actually passes one.
    // Reverting `store.ts` to a foreign-only norm failed nothing at all.
    //
    // Thirty-two of the richest clubs in Europe have no cheap tail, so a norm
    // taken from them alone flattens every position's spread and a first-choice
    // keeper reads as big a star as a €120M forward.
    const clear = game().foreign.clubs.filter((club) => {
      const squad = game().foreign.squads[club.id] ?? []
      const keeper = Math.max(...squad.filter((p) => p.position === 'GK').map(overall))
      const outfield = Math.max(...squad.filter((p) => p.position !== 'GK').map(overall))
      return keeper - outfield >= 2
    })
    expect(clear.length).toBeLessThan(10)
  })

  it('goes back to the crests from a club', () => {
    const clubId = aRival()
    browse(clubId)
    expect(tiles()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: t('market.allClubs') }))
    expect(tiles().length).toBeGreaterThan(0)
    expect(document.querySelector('.data-table__row')).toBeNull()
  })

  it('asks more for a man his club picked than his bare price', () => {
    // The column a manager is actually reading: not what the player is worth,
    // but what it would take. A starter's is a multiple of his asking price; a
    // spare player's is exactly it.
    const clubId = aRival()
    browse(clubId)
    const squad = game().squads[clubId] ?? []
    const spare = new Set(surplus(squad).map((p) => p.id))
    const starter = squad.find((p) => !spare.has(p.id))
    const sold = squad.find((p) => spare.has(p.id))
    if (starter === undefined || sold === undefined) throw new Error('no contrast')

    const date = game().season.currentDate
    expect(scoutedPrice(squad, starter, date)).toBeGreaterThan(askingPrice(starter, date) * 1.5)
    expect(scoutedPrice(squad, sold, date)).toBe(askingPrice(sold, date))
  })

  it('stays a five-column scan — the detail lives on the card', () => {
    // Not a secrecy rule: the ficha shows wage and contract for anybody, and has
    // to, since you cannot judge personal terms without knowing what he earns.
    // This guards against columns creeping into a table that spans nineteen
    // squads. `needFor` is the one thing that must never appear on either.
    openClubs()
    const headers = [...document.querySelectorAll('.data-table__head th')].map(
      (th) => th.textContent ?? '',
    )
    expect(headers.join(' ')).not.toMatch(/wage|contract|salary/i)
  })

  it('opens a rival starter’s card, which is the route to bidding for him', () => {
    // **The case that had no route at all before this tab.** A listing is by
    // definition a player his club will sell, so the market table could only
    // ever reach a premium of exactly 1.
    const clubId = aRival()
    browse(clubId)
    const squad = game().squads[clubId] ?? []
    const spare = new Set(surplus(squad).map((p) => p.id))
    const starter = squad.find((p) => !spare.has(p.id))
    if (starter === undefined) throw new Error('no starter')

    fireEvent.click(screen.getByRole('button', { name: starter.name }))
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))

    const dialog = within(screen.getByRole('dialog'))
    const club = game().clubs.find((c) => c.id === clubId)?.name ?? ''
    expect(dialog.getByText(t('bid.reluctant', { club }))).toBeDefined()
    expect((dialog.getByLabelText(/Fee/i) as HTMLInputElement).value).toBe(
      String(scoutedPrice(squad, starter, game().season.currentDate)),
    )
  })

  it('keeps the club you were reading when you look at a card and come back', () => {
    // **Found by driving the built app, not by a test.** These were `useState` in
    // the screen, which unmounts the moment a `PlayerLink` opens a ficha — so
    // scouting a club, clicking a name to see whether he was worth it and pressing
    // Volver landed you on a two-hundred-row For sale table with the club
    // forgotten. The browser was very nearly unusable and the suite was green.
    const clubId = game().clubs.at(-1)?.id ?? ''
    browse(clubId)
    const name = (game().squads[clubId] ?? [])[0]?.name ?? ''

    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('heading', { name })).toBeDefined()
    back()

    expect(
      screen.getByRole('button', { name: t('market.tab.clubs') }).getAttribute('aria-pressed'),
    ).toBe('true')
    // Back on *that club's squad*, not on the grid and not on the For sale table.
    // The assertion moved from a `<select>`'s value to what is actually rendered,
    // which is the stronger claim anyway.
    expect(tiles()).toHaveLength(0)
    const club = game().clubs.find((c) => c.id === clubId)?.name ?? ''
    expect(screen.getByText(club, { selector: '.club-grid__heading' })).toBeDefined()
  })

  it('completes a bid for a man who was never for sale', () => {
    const clubId = aRival()
    browse(clubId)
    const squad = game().squads[clubId] ?? []
    const spare = new Set(surplus(squad).map((p) => p.id))
    // The cheapest outfield starter, so the bid is inside even a rich club's
    // overdraft. Not a keeper: a club's last spare-less keeper is refused outright
    // (`refuseUnsellable`), and whether the cheapest starter is one moves with the squads.
    const date = game().season.currentDate
    const starter = squad
      .filter((p) => !spare.has(p.id) && p.position !== 'GK')
      .sort((a, b) => scoutedPrice(squad, a, date) - scoutedPrice(squad, b, date))[0]
    if (starter === undefined) throw new Error('no starter')

    fireEvent.click(screen.getByRole('button', { name: starter.name }))
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('market.makeBid') }),
    )

    expect(game().bids.some((bid) => bid.playerId === starter.id)).toBe(true)
  })

  /**
   * A player abroad who is **not** in `listingsFor`.
   *
   * **The precondition is the whole test design.** `selected` finds a listed
   * player through `all` and never reaches the bid fallback, so a listed subject
   * would exercise the naming half and silently skip the half that made the deal
   * impossible to finish. Abroad, `listingsFor` publishes only `FOREIGN_LISTINGS`
   * of a club's fringe, so everyone else is reachable through the Clubs tab and
   * nowhere else — which is exactly the state the reported defect lived in.
   *
   * Cheapest first so the fee is inside even Madrid's overdraft, and skipping
   * anyone his club would refuse on squad grounds so the only answer under test
   * is the one about the fee.
   */
  const someoneAbroad = () => {
    const state = game()
    const date = state.season.currentDate
    const listed = new Set(listingsFor(state).map((l) => l.player.id))

    const options = state.foreign.clubs.flatMap((club) => {
      const squad = state.foreign.squads[club.id] ?? []
      return squad
        .filter((player) => !listed.has(player.id) && aiSaleRefusal(squad, player) === null)
        .map((player) => ({ club, player, price: scoutedPrice(squad, player, date) }))
    })
    const pick = [...options].sort((a, b) => a.price - b.price)[0]
    if (pick === undefined) throw new Error('nobody reachable abroad')
    // Stated rather than left to the filter: if this ever became false the tests
    // below would pass while proving nothing.
    expect(listed.has(pick.player.id)).toBe(false)
    return pick
  }

  /** Bids what his club will take, then waits for the answer off the market. */
  const agreeAFeeAbroad = () => {
    const { club, player } = someoneAbroad()
    browse(club.id)

    fireEvent.click(screen.getByRole('button', { name: player.name }))
    fireEvent.click(screen.getByRole('button', { name: t('player.bid') }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: t('market.makeBid') }),
    )

    // Waiting somewhere other than the market, for the reason the domestic
    // version of this test records: the answer arrives with the clock, and
    // ticking on a two-hundred-row table measures the table.
    back()
    back()
    advanceUntil(() => game().bids.find((bid) => bid.playerId === player.id)?.status !== 'pending')
    expect(game().bids.find((bid) => bid.playerId === player.id)?.status).toBe('accepted')

    openScreen('nav.market')
    const outbox = document.querySelector('.market-screen__outbox')
    if (outbox === null) throw new Error('no outbox')
    return {
      club,
      player,
      outbox: within(outbox as HTMLElement),
      outboxText: () => outbox.textContent ?? '',
    }
  }

  it('names a man you have bid for abroad instead of calling him unknown', () => {
    // The visible half of the defect: the lookup behind this row was built from
    // the division alone, so every player abroad read as `market.unknownPlayer`.
    const { player, outbox, outboxText } = agreeAFeeAbroad()

    expect(outbox.getByText(player.name)).toBeDefined()
    expect(outboxText()).not.toContain(t('market.unknownPlayer'))
  })

  it('finishes a signing from abroad — Open reaches personal terms', () => {
    // **The half that made a cross-border transfer impossible.** With the player
    // unresolvable, `selected` came out `null` and the negotiation panel never
    // mounted, so Open was a silent no-op and there was no route to terms at all:
    // `BidPanel` deliberately does not carry that stage.
    const { club, player, outbox } = agreeAFeeAbroad()

    fireEvent.click(outbox.getByRole('button', { name: t('market.openNegotiation') }))
    expect(screen.getByRole('heading', { name: player.name })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: t('market.offerTerms') }))
    confirm()

    expect((game().squads[RICH] ?? []).some((p) => p.id === player.id)).toBe(true)
    // And he has actually left, rather than turning up in two squads at once.
    expect((game().foreign.squads[club.id] ?? []).some((p) => p.id === player.id)).toBe(false)
  })
})

describe('sorting the market', () => {
  const firstRowName = () => rowNames()[0] ?? ''
  // Scoped to the table head. The screen gained a `Clubs` tab, whose label the
  // `Club` column's regex also matches — a header query has to mean the header.
  const head = () => {
    const el = document.querySelector('.data-table__head')
    if (el === null) throw new Error('no table head')
    return within(el as HTMLElement)
  }
  const header = (label: string) =>
    head()
      .getByRole('button', { name: new RegExp(`^${label}`) })
      .closest('th')

  it('starts unsorted — market order is the shuffle', () => {
    openMarket()
    for (const label of ['Player', 'Club', 'Age', 'Ovr', 'Asking']) {
      expect(header(label)?.getAttribute('aria-sort')).toBe('none')
    }
  })

  it('sorts by asking price, cheapest first on a second click', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: /^Asking/ }))
    expect(header('Asking')?.getAttribute('aria-sort')).toBe('descending')
    const dearest = firstRowName()

    fireEvent.click(screen.getByRole('button', { name: /^Asking/ }))
    expect(header('Asking')?.getAttribute('aria-sort')).toBe('ascending')
    expect(firstRowName()).not.toBe(dearest)

    // Cheapest first: this is how a club with no money finds what it can buy.
    const fees = rowFees()
    expect(fees).toEqual([...fees].sort((a, b) => a - b))
  })

  it('cycles back to market order on a third click', () => {
    // Without a way back, one click would cost you the shuffle for the session.
    openMarket()
    const shuffled = rowNames()

    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    expect(rowNames()).not.toEqual(shuffled)
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))

    expect(header('Ovr')?.getAttribute('aria-sort')).toBe('none')
    expect(rowNames()).toEqual(shuffled)
  })

  it('moves the marker to whichever column is active', () => {
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: /^Age/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Ovr/ }))
    expect(header('Ovr')?.getAttribute('aria-sort')).toBe('descending')
    expect(header('Age')?.getAttribute('aria-sort')).toBe('none')
  })
})

describe('a club with no money', () => {
  // The case the sixty-row cap broke: at Almería 198 of 228 listings improve the
  // XI and 125 are affordable, but only five of the visible sixty were both.
  const POOR = DEFAULT_CLUBS.at(-1)?.id
  if (POOR === undefined) throw new Error('no clubs')

  it('can reach the signings it can actually afford', () => {
    useGame.getState().newGame(POOR)
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))

    const budget = game().clubs.find((c) => c.id === POOR)?.budget ?? 0
    // `needFor` is a domain question now — the screen deliberately no longer
    // answers it for you, so the test asks the domain directly.
    const squad = game().squads[POOR] ?? []
    const useful = listingsFor(game()).filter(
      (l) => l.fee <= budget && needFor(squad, l.player) > 0,
    )

    expect(useful.length).toBeGreaterThan(20)
    const shown = allRowNames()
    for (const listing of useful) expect(shown.has(listing.player.name)).toBe(true)
  })
})

/**
 * Picking an agreed fee back up from `Your bids`.
 *
 * This is where a transfer goes to die. The rail is its own scroll container,
 * the negotiation panel opens at the top of it and `Your bids` is at the bottom,
 * so every one of these used to look identical from the manager's chair:
 * nothing happened.
 */
describe('reopening a deal', () => {
  /** Bid the asking price for one listing, which is always accepted. */
  function bidAsking(name: string) {
    // These are the two *cheapest* listings, which in market order sit wherever the
    // shuffle put them — page one is not a safe assumption once the table pages.
    const row = goToRow(name)
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make bid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  }

  /** Two bids at the asking price, run on until both fees are agreed. */
  function twoAgreedBids() {
    openMarket()
    // **The two cheapest, not the first two on the list.** These tests are about
    // the negotiation panel, and the market now carries fringe players from the
    // richest clubs in Europe — the first two rows of the shuffle can cost more
    // than a whole budget, and the bid is refused before the panel is involved.
    const affordable = [...listingsFor(game())].sort((a, b) => a.fee - b.fee)
    const first = affordable[0]
    // **And they must want different wages.** `carries no numbers over` compares
    // the two prefills, so two men on the `expectedWage` floor of 50 would satisfy
    // it while proving nothing — its own comment says so, and the two cheapest
    // listings are exactly the pair that lands there.
    const date = game().season.currentDate
    const wageOf = (listing: { player: Parameters<typeof suggestedTerms>[0] }) =>
      suggestedTerms(listing.player, date).wage
    const second =
      first === undefined ? undefined : affordable.find((l) => wageOf(l) !== wageOf(first))
    if (first === undefined || second === undefined) throw new Error('not enough listings')

    bidAsking(first.player.name)
    bidAsking(second.player.name)

    back()
    for (let day = 0; day < 5 && game().bids.some((b) => b.status === 'pending'); day++) {
      advance()
    }
    expect(game().bids.filter((b) => b.status === 'accepted')).toHaveLength(2)

    openScreen('nav.market')
    return { first, second }
  }

  const wageField = () => screen.getByLabelText(/^Wage/) as HTMLInputElement

  /**
   * Scoped to `Your bids`: the same man is also a row in the table above, and the
   * whole point of this panel is that it is a *second* way to reach him.
   */
  const openBid = (name: string) => {
    const outbox = document.querySelector('.market-screen__outbox')
    if (outbox === null) throw new Error('no outbox')
    const item = within(outbox as HTMLElement)
      .getByText(name)
      .closest('.offer-list__item')
    if (item === null) throw new Error(`no bid row for ${name}`)
    fireEvent.click(within(item as HTMLElement).getByRole('button', { name: 'Open' }))
  }

  it('scrolls the deal into view, because it opens above where you pressed', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { first } = twoAgreedBids()

    openBid(first.player.name)

    expect(scrollIntoView).toHaveBeenCalled()
    scrollIntoView.mockRestore()
  })

  it('marks which bid the panel is showing', () => {
    const { first, second } = twoAgreedBids()

    openBid(second.player.name)

    const active = [...document.querySelectorAll('.offer-list__item.is-active')]
    expect(active).toHaveLength(1)
    expect(active[0]?.textContent).toContain(second.player.name)
    expect(active[0]?.textContent).not.toContain(first.player.name)
  })

  /**
   * The panel's fields are `useState` initialisers, which run once. Without a key
   * the second player inherited the first one's wage — and offering a wage below
   * what a man wants is refused with the state untouched, so the deal simply
   * would not close and nothing said why.
   */
  it('carries no numbers over from the deal before it', () => {
    const { first, second } = twoAgreedBids()

    openBid(first.player.name)
    const firstWage = wageField().value

    openBid(second.player.name)
    expect(wageField().value).toBe(
      String(suggestedTerms(second.player, game().season.currentDate).wage),
    )
    // Guard on the guard: if both men wanted the same wage this would pass while
    // proving nothing.
    expect(wageField().value).not.toBe(firstWage)
  })

  /**
   * A refusal that does not throw. `offerContract` returns `TermsRejected` and
   * leaves the state alone, so a screen watching only for thrown errors showed a
   * button that did nothing — and the feed that used to carry the sentence now
   * lives on the hub, a screen away from the press.
   */
  it('says so when he turns the terms down', () => {
    const { first } = twoAgreedBids()
    openBid(first.player.name)

    fireEvent.change(wageField(), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Offer terms' }))
    confirm()

    expect(screen.getByRole('alert').textContent).toContain(first.player.name)
    // A refusal is an outcome, not a mistake: the bid stays live so the terms can
    // be improved. Only our own — since M4c the clock brings in offers for our
    // players too, so `bids` runs in both directions.
    expect(
      game()
        .bids.filter((b) => b.from === RICH)
        .filter(bidIsLive),
    ).toHaveLength(2)
  })

  /**
   * A bid outlives its listing. `listingsFor` is rebuilt from each club's live
   * `surplus`, and a club at the minimum squad size has none — so the player you
   * have already agreed a fee for can vanish from the market table while the bid
   * sits there. Opening it must still work.
   */
  it('opens a bid whose player is no longer listed', () => {
    const { first } = twoAgreedBids()

    // Shrink the seller to the point where nobody is spare, keeping our man.
    const state = game()
    const sellerId = first.from
    if (sellerId === null) throw new Error('expected a listed player, not a free agent')
    const seller = state.squads[sellerId] ?? []
    const trimmed = [
      ...seller.filter((p) => p.id !== first.player.id).slice(0, MIN_SQUAD - 1),
      first.player,
    ]
    useGame.setState({ game: { ...state, squads: { ...state.squads, [sellerId]: trimmed } } })

    expect(listingsFor(game()).some((l) => l.player.id === first.player.id)).toBe(false)

    openBid(first.player.name)
    expect(screen.getByRole('heading', { name: first.player.name })).toBeDefined()
  })

  it('opens the ficha from a bid of your own', () => {
    const { first } = twoAgreedBids()

    // Scoped for the same reason `openBid` is: the man is a link in the table
    // above as well, and this panel is the *second* way to reach him.
    const outbox = document.querySelector('.market-screen__outbox')
    if (outbox === null) throw new Error('no outbox')
    fireEvent.click(within(outbox as HTMLElement).getByRole('button', { name: first.player.name }))

    expect(screen.getByRole('heading', { name: first.player.name })).toBeDefined()
    back()
    expect(screen.getByRole('heading', { name: 'Transfer market' })).toBeDefined()
  })

  it('opens the ficha from the deal you are negotiating', () => {
    // The panel asks you to commit money to a man whose card was two screens
    // away. Its heading is the name, so the name is the way in.
    const { first } = twoAgreedBids()
    openBid(first.player.name)

    const heading = screen.getByRole('heading', { name: first.player.name })
    fireEvent.click(within(heading).getByRole('button', { name: first.player.name }))

    expect(screen.getByRole('heading', { name: first.player.name })).toBeDefined()
    expect(useGame.getState().inspectedPlayerId).toBe(first.player.id)
  })
})

describe('the window', () => {
  it('is open at the start of a season', () => {
    expect(isTransferWindowOpen(game().season.currentDate)).toBe(true)
  })

  it('closes bidding once it shuts', () => {
    // Run to October, well past August.
    render(<App />)
    for (let day = 0; day < 60; day++) {
      advance()
    }
    openScreen('nav.market')

    expect(screen.getByText(/The window is shut/)).toBeDefined()
    for (const button of screen.getAllByRole('button', { name: 'Bid' })) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
  })
})

describe('the end of a season', () => {
  it('is a door to the next one rather than a dead end', () => {
    // Before M4b this button read "Season over" and was disabled forever, because
    // nothing in the UI could reach a rollover.
    render(<App />)
    const played = () => game().season.fixtures.filter((f) => f.result !== null).length
    for (let day = 0; day < 400 && played() < 380; day++) {
      advance()
    }

    const rollover = screen.getByRole('button', { name: /^Start 2027\/28$/ })
    expect(rollover.hasAttribute('disabled')).toBe(false)

    fireEvent.click(rollover)
    expect(game().season.startYear).toBe(2027)
    expect(game().season.fixtures.filter((f) => f.result !== null)).toHaveLength(0)
    expect(screen.getByRole('button', { name: ADVANCE() })).toBeDefined()
  })
})

/**
 * The signing bonus, and the filter that used to pretend it did not exist.
 *
 * `affordable` in the reducer has always charged `fee + 10%`, so the bonus was
 * real from M5a onward — it simply had no way of reaching the manager except as
 * a refusal, or as a line on the accounts a week later that he had not agreed to.
 */
describe('what a bid really costs', () => {
  it('states the bonus and the total before you commit', () => {
    openMarket()
    const { target, row } = firstListingRow()
    fireEvent.click(within(row).getByRole('button', { name: 'Bid' }))

    const { t, money, percent } = translatorFor('en')
    expect(
      screen.getByText(
        t('market.outlay', {
          bonus: money(signingOutlay(target.fee) - target.fee),
          total: money(signingOutlay(target.fee)),
          percent: percent(FINANCE.SIGNING_BONUS),
        }),
      ),
    ).toBeDefined()
  })

  /**
   * The filter now asks the reducer's own question. It used to compare the bare
   * fee against the bare balance, which was wrong twice over: blind to the bonus,
   * so it offered deals `MakeBid` then refused; and blind to the overdraft, so it
   * hid every player the club could legally borrow for.
   */
  it('only offers deals the reducer would actually accept', () => {
    // A club with something to worry about — Madrid can afford the whole league.
    useGame.getState().newGame(DEFAULT_CLUBS[19]?.id ?? '')
    openMarket()
    fireEvent.click(screen.getByRole('button', { name: 'Within budget' }))

    const club = game().clubs.find((c) => c.id === game().managedClubId)
    if (club === undefined) throw new Error('no club')
    const clubCount = game().competition.clubIds.length
    const shown = allRowNames()

    const all = listingsFor(game())
    for (const listing of all) {
      const reducerWouldTake = canAfford(
        club,
        signingOutlay(listing.fee),
        clubCount,
        ROUNDS_PER_HALF,
      )
      expect(shown.has(listing.player.name), listing.player.name).toBe(reducerWouldTake)
    }

    // A guard on the guard: a filter that let everything through would satisfy
    // the loop above without discriminating at all.
    expect(shown.size).toBeGreaterThan(0)
    expect(shown.size).toBeLessThan(all.length)
  })
})

describe('what a market column sorts on', () => {
  const { t } = translatorFor('en')

  it('sorts the club column on the name shown, not on the club id', () => {
    // It sorted on `listing.from`, an ASCII slug — `a-coruna` for `A Coruña`. On
    // today's twenty clubs slug order and name order coincide exactly, so nothing
    // looked wrong; the column was simply keyed on something it does not display.
    // Asserted on the accessor rather than on the rendered order, because an order
    // that is currently identical either way would prove nothing.
    const seller = DEFAULT_CLUBS.find((c) => c.id === 'a-coruna')
    if (seller === undefined) throw new Error('no club')

    const listing = { player: {} as never, from: seller.id, fee: 0 }
    expect(listingValue(listing, 'club', fromCivil(2026, 8, 15), () => seller.name)).toBe(
      seller.name,
    )
    expect(listingValue(listing, 'club', fromCivil(2026, 8, 15), () => seller.name)).not.toBe(
      seller.id,
    )
  })

  it('leaves a free agent with no club to sort by, so they stay together', () => {
    const listing = { player: {} as never, from: null, fee: 0 }
    expect(listingValue(listing, 'club', fromCivil(2026, 8, 15), () => 'unused')).toBe('')
    expect(listingValue(listing, 'club', fromCivil(2026, 8, 15), () => 'unused')).not.toBe(
      t('market.freeAgent'),
    )
  })
})
