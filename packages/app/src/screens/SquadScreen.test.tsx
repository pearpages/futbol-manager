import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { bestXI, surplus, toCivil, wageBill } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { back, openScreen } from '../testing.ts'
import { translatorFor } from '../i18n/useT.ts'

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
  openScreen('nav.squad')
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
  it('numbers the rows, so the last one is the squad size', () => {
    // The point of the column. Squad size is load-bearing — the reducer refuses
    // a bid at MAX_SQUAD and a club at MIN_SQUAD can sell nobody — so "how many
    // do I have" should not mean counting rows.
    openSquad()

    const numbers = [...document.querySelectorAll('.squad-screen .data-table__num')].map((cell) =>
      Number(cell.textContent),
    )
    const size = (game().squads[game().managedClubId] ?? []).length

    expect(numbers).toHaveLength(size)
    expect(numbers).toEqual(Array.from({ length: size }, (_, i) => i + 1))
  })

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
    expect(button.getAttribute('title')).toMatch(/starting eleven/)
  })

  it('lets you sell a man your own formation benches', () => {
    // The reported bug, and the one a person actually hits. Sellability used to be
    // judged against a fixed 4-4-2, so switching shape left rows reading "—" in the
    // Convocado column while their button refused them as first-team — a
    // contradiction on a single line, and no way to act on either half of it.
    const squad = game().squads[game().managedClubId] ?? []
    const reference = new Set(bestXI(squad, '4-4-2').starters)
    useGame.getState().dispatch({
      type: 'SetLineup',
      clubId: game().managedClubId,
      lineup: bestXI(squad, '4-2-4'),
    })

    const starting = new Set(game().lineups[game().managedClubId]?.starters ?? [])
    const benched = squad.filter((p) => !starting.has(p.id) && reference.has(p.id))
    expect(benched.length).toBeGreaterThan(0)

    openSquad()
    for (const player of benched) {
      const row = rowFor(player.name)
      // The two halves of the row that used to disagree.
      expect(within(row).getByText('—')).toBeDefined()
      const button = within(row).getByRole('button', { name: 'List' })
      expect(button.hasAttribute('disabled')).toBe(false)
    }
  })

  it('says it is the goalkeeper, not the first team, when that is the reason', () => {
    // The other half of the same complaint: 14 of 20 clubs open a career with a
    // reserve keeper who cannot be sold, and every one of them used to be told he
    // was in the first team.
    const squad = game().squads[game().managedClubId] ?? []
    const starting = new Set(game().lineups[game().managedClubId]?.starters ?? [])
    const keepers = squad.filter((p) => p.position === 'GK')
    const reserve = keepers.find((p) => !starting.has(p.id))
    if (reserve === undefined) throw new Error('no reserve keeper')

    // Cut to two, so selling him would leave one.
    useGame.setState({
      game: {
        ...game(),
        squads: {
          ...game().squads,
          [game().managedClubId]: squad.filter(
            (p) => p.position !== 'GK' || p.id === reserve.id || starting.has(p.id),
          ),
        },
      },
    })

    openSquad()
    const button = within(rowFor(reserve.name)).getByRole('button', { name: 'List' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('title')).toMatch(/goalkeeper/)
    expect(button.getAttribute('title')).not.toMatch(/eleven/)
  })

  it('survives navigating away and back', () => {
    openSquad()
    const player = aSpare()
    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))

    back()
    openScreen('nav.table')
    back()
    openScreen('nav.squad')

    expect(within(rowFor(player.name)).getByRole('button', { name: 'Listed' })).toBeDefined()
  })
})

describe('the market screen shows what you have put up', () => {
  it('is explicit that nothing is on the market by default', () => {
    render(<App />)
    openScreen('nav.market')
    expect(screen.getByText(/Your squad is invisible to other clubs/)).toBeDefined()
  })

  it('lists him with an asking price once he is up for sale', () => {
    openSquad()
    const player = aSpare()
    fireEvent.click(within(rowFor(player.name)).getByRole('button', { name: 'List' }))

    back()
    openScreen('nav.market')
    const panel = screen.getByRole('heading', { name: 'Up for sale' }).closest('section')
    if (panel === null) throw new Error('no panel')

    expect(within(panel).getByText(player.name)).toBeDefined()
    fireEvent.click(within(panel).getByRole('button', { name: 'Take off' }))
    expect(game().transferList).toEqual([])
  })
})

describe('what the squad costs', () => {
  /**
   * The wage bill was a single figure on the Caja screen attributable to nobody:
   * `player.contract.wage` was rendered for no player you own, anywhere. So the
   * one number the board never judges you on was also the one you could not act
   * on.
   */
  it('shows every wage, and they add up to the bill', () => {
    openSquad()
    const { t, money } = translatorFor('en')
    const squad = game().squads[game().managedClubId] ?? []

    expect(screen.getByRole('columnheader', { name: t('squad.column.wage') })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: t('squad.column.contract') })).toBeDefined()

    for (const player of squad) {
      const row = within(rowFor(player.name))
      expect(row.getAllByText(money(player.contract.wage)).length, player.name).toBeGreaterThan(0)
    }

    // The claim the column is for: the rows account for the Caja total exactly.
    const shown = squad.reduce((sum, p) => sum + p.contract.wage, 0)
    expect(shown).toBe(wageBill(squad))
  })

  it('dates the contract by its year, since they all run to 30 June', () => {
    openSquad()
    const player = aSpare()
    const row = within(rowFor(player.name))
    expect(row.getAllByText(String(toCivil(player.contract.until).y)).length).toBeGreaterThan(0)
  })
})

describe('sorting the squad', () => {
  const { t } = translatorFor('en')

  /** The rendered rows as `[number, position chip, name]`, in order. */
  function rendered() {
    return [...document.querySelectorAll('.squad-screen tbody tr')].map((tr) => {
      const cells = tr.querySelectorAll('td')
      return {
        number: Number(cells[0]?.textContent),
        position: cells[1]?.textContent?.trim() ?? '',
        name: cells[2]?.textContent?.trim() ?? '',
      }
    })
  }

  const header = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

  /** Which players currently offer a usable List button. */
  function listable() {
    return rendered()
      .filter(({ name }) => {
        const button = within(rowFor(name)).getByRole('button', { name: /^(List|Listed)$/ })
        return !(button as HTMLButtonElement).disabled
      })
      .map((r) => r.name)
      .sort()
  }

  it('sorts by wage, dearest first', () => {
    // The question the wage column was added to answer, and it could not be asked.
    openSquad()
    fireEvent.click(header(t('squad.column.wage')))

    const squad = game().squads[game().managedClubId] ?? []
    const wageOf = new Map(squad.map((p) => [p.name, p.contract.wage]))
    const shown = rendered().map((r) => wageOf.get(r.name) ?? 0)

    expect(shown).toEqual([...shown].sort((a, b) => b - a))
    expect(shown[0]).toBe(Math.max(...squad.map((p) => p.contract.wage)))
  })

  it('still numbers the rows 1..N once sorted', () => {
    // The `#` column counts the rows as rendered, so it renumbers rather than
    // travelling with a player. Its existing invariant has to survive the feature.
    openSquad()
    fireEvent.click(header(t('squad.column.age')))

    const numbers = rendered().map((r) => r.number)
    const size = (game().squads[game().managedClubId] ?? []).length
    expect(numbers).toEqual(Array.from({ length: size }, (_, i) => i + 1))
  })

  it('sorts positions by the team sheet, not by the alphabet of the label', () => {
    // Sorting the rendered chip would order Catalan `POR/DEF/MIG/DAV` as
    // DAV→DEF→MIG→POR and English `GK/DF/MF/FW` as DF→FW→GK→MF — the same squad
    // reading differently in each language. The domain's own order is language-free.
    openSquad()
    fireEvent.click(header(t('squad.column.position')))
    fireEvent.click(header(t('squad.column.position'))) // ascending: keepers first

    const order = ['GK', 'DF', 'MF', 'FW']
    const ranks = rendered().map((r) => order.indexOf(r.position))
    expect(ranks).not.toContain(-1)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('does not change who is sellable when you sort the table', () => {
    // `surplus` runs `bestXI`, which orders on `overall` alone — and `Array.sort` is
    // stable, so among players level on overall in a position, whoever comes first in
    // the input takes the shirt. Feed it the *displayed* order and a manager's click
    // silently decides which players he is allowed to sell.
    //
    // San Sebastián, specifically: at the opening seed a wage sort moves four players
    // in and out of its surplus. Written at the default mid-table club this passed
    // with the bug in place — that squad happens to have no tie at an XI boundary, so
    // it proved nothing. Measured across the division, 8 of 20 clubs are affected.
    useGame.getState().newGame('san-sebastian')
    render(<App />)
    openScreen('nav.squad')

    const before = listable()
    expect(before.length).toBeGreaterThan(0)

    fireEvent.click(header(t('squad.column.wage')))
    expect(listable()).toEqual(before)

    fireEvent.click(header(t('squad.column.player')))
    expect(listable()).toEqual(before)
  })
})
