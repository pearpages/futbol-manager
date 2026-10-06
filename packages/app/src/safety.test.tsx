import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { addDays, type Bid, type BidId } from '@fm/domain'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from './App.tsx'
import { translatorFor } from './i18n/useT.ts'
import { useGame } from './store.ts'
import { confirm, openScreen } from './testing.ts'

/**
 * Learning without destructive actions (ADR 0019): what cannot be undone asks
 * first and saying no leaves everything as it was; what can be undone is done at
 * once and offered back.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const { t } = translatorFor('en')
const game = () => useGame.getState().game
const cancel = () => {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: t('action.cancel') }),
  )
}

beforeEach(() => {
  useGame.getState().newGame(MID)
  useGame.getState().setLanguage('en')
})

/** Another club's player you can bid for. */
function target() {
  const other = game().clubs.find((c) => c.id !== MID)
  const player =
    other === undefined ? undefined : game().squads[other.id]?.find((p) => p.position === 'MF')
  if (player === undefined) throw new Error('no target')
  return player
}

describe('bidding again', () => {
  it('keeps the old bid when the new one is refused', () => {
    const player = target()
    useGame.getState().dispatch({ type: 'MakeBid', playerId: player.id, fee: 100 })
    const before = game()
    const old = before.bids.find((b) => b.playerId === player.id)
    if (old === undefined) throw new Error('no bid')

    // Far past the overdraft: the new bid is refused.
    expect(() =>
      useGame.getState().dispatchAll([
        { type: 'WithdrawBid', bidId: old.id },
        { type: 'MakeBid', playerId: player.id, fee: 1e12 },
      ]),
    ).toThrow()
    expect(game()).toBe(before)
    expect(game().bids.find((b) => b.id === old.id)?.status).toBe('pending')
  })
})

describe('selling', () => {
  it('asks before accepting an offer, and no means no sale', () => {
    const starters = game().lineups[MID]?.starters ?? []
    const mine = game().squads[MID]?.find((p) => p.position === 'MF' && !starters.includes(p.id))
    const buyer = game().clubs.find((c) => c.id !== MID)
    if (mine === undefined || buyer === undefined) throw new Error('no setup')
    const offer: Bid = {
      id: 'offer-1' as BidId,
      playerId: mine.id,
      from: buyer.id,
      to: MID,
      fee: 5000,
      status: 'pending',
      counterFee: null,
      madeOn: game().season.currentDate,
      answerOn: addDays(game().season.currentDate, 3),
    }
    useGame.setState({ game: { ...game(), bids: [offer] } })
    render(<App />)
    openScreen('nav.market')

    fireEvent.click(screen.getByRole('button', { name: t('market.accept') }))
    expect(screen.getByRole('dialog', { name: t('confirm.sell.title', { name: mine.name }) }))
    cancel()
    expect(game().squads[MID]?.some((p) => p.id === mine.id)).toBe(true)
    expect(game().bids[0]?.status).toBe('pending')

    fireEvent.click(screen.getByRole('button', { name: t('market.accept') }))
    confirm()
    expect(game().squads[MID]?.some((p) => p.id === mine.id)).toBe(false)
  })
})

describe('the stadium', () => {
  it('asks before paying for works, and no costs nothing', () => {
    render(<App />)
    openScreen('nav.estadio')
    const budget = game().clubs.find((c) => c.id === MID)?.budget
    fireEvent.click(screen.getByRole('button', { name: t('estadio.begin') }))
    cancel()
    expect(game().clubs.find((c) => c.id === MID)?.budget).toBe(budget)
  })
})

describe('starting a career', () => {
  it('shows what you are taking on, and no keeps you choosing', () => {
    useGame.getState().startNewCareer()
    render(<App />)
    const first = screen.getAllByRole('button', { name: t('setup.takeCharge') })[0]
    fireEvent.click(first as HTMLElement)
    cancel()
    expect(useGame.getState().needsSetup).toBe(true)
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()
  })

  it('asks nothing at the door when no career is in memory', () => {
    useGame.getState().startNewCareer()
    useGame.setState({ entry: 'landing' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: t('action.newCareer') }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: t('setup.heading') })).toBeDefined()
  })
})

describe('a formation press', () => {
  it('rebuilds the XI at once and offers it back', () => {
    render(<App />)
    openScreen('nav.lineup')
    const before = game().lineups[MID]
    if (before === undefined) throw new Error('no lineup')
    const other = screen
      .getAllByRole('button')
      .find((b) => /^\d-\d-\d$/.test(b.textContent ?? '') && b.textContent !== before.formation)
    if (other === undefined) throw new Error('no other formation')
    fireEvent.click(other)
    expect(game().lineups[MID]?.formation).not.toBe(before.formation)

    fireEvent.click(screen.getByRole('button', { name: t('action.undo') }))
    expect(game().lineups[MID]).toEqual(before)
    expect(screen.queryByRole('button', { name: t('action.undo') })).toBeNull()
  })
})
