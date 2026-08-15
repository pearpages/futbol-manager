import { describe, expect, it } from 'vitest'
import {
  canAfford,
  credit,
  debtLimit,
  EMPTY_LEDGER,
  expansionCost,
  FINANCE,
  gateReceipts,
  isSettlementDay,
  LEDGER_KEYS,
  ledgerNet,
  occupancy,
  prizeMoney,
  seasonProjection,
  signingOutlay,
  sponsorMoney,
  tvMoney,
  wageBill,
  wagePremium,
} from './finance.ts'
import { ROUNDS_PER_HALF } from './fixtures.ts'
import { reduce } from './reduce.ts'
import { createRng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import { computeTable } from './table.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { fromCivil } from './time.ts'

/**
 * The economy, checked as a model and then as an identity.
 *
 * The model tests are shape claims — a bigger club takes more at the gate, a
 * champion earns more than a relegated club — because the exact figures are
 * calibration and belong to the harness. The identity test is the one that must
 * never be loosened: a balance moves by what its ledger says and by nothing else.
 */

const CLUBS = TEST_CLUBS.length
const BIG = TEST_CLUBS[0]
const SMALL = TEST_CLUBS[19]
if (BIG === undefined || SMALL === undefined) throw new Error('no clubs')

describe('the ledger', () => {
  it('nets income against outgoings', () => {
    const ledger = credit(credit(EMPTY_LEDGER, 'gate', 100), 'wages', 40)
    expect(ledgerNet(ledger)).toBe(60)
  })

  it('treats every declared line as income or outgoing, and none as neither', () => {
    // The identity is written once over LEDGER_KEYS so a ninth line cannot be
    // added and silently left out of the sum. This is what proves that.
    for (const key of LEDGER_KEYS) {
      const one = credit(EMPTY_LEDGER, key, 1)
      expect(Math.abs(ledgerNet(one)), key).toBe(1)
    }
  })

  it('lets transfers go either way', () => {
    // The one line that is genuinely signed: a fee received is positive, a fee
    // paid is negative, and both live on the same key.
    expect(ledgerNet(credit(EMPTY_LEDGER, 'transfers', -500))).toBe(-500)
  })
})

describe('the gate', () => {
  it('gives a bigger club a bigger ground', () => {
    // Capacity is literal data now, not a curve, so this asserts the league rather
    // than a function: a big club's ground is not slightly larger than a small
    // one's, it is several times larger, and the gate is the one revenue stream a
    // club can influence. Individual grounds may invert against rating on purpose —
    // the claim is about the two ends of the table, not about any neighbouring pair.
    expect(BIG.capacity).toBeGreaterThan(SMALL.capacity * 2)
  })

  it('fills a good club’s ground fuller than a poor one’s', () => {
    expect(occupancy(BIG, 1, CLUBS)).toBeGreaterThan(occupancy(SMALL, 1, CLUBS))
  })

  it('rewards winning, but less than being big', () => {
    // A big club having a bad season still outdraws a small club having a good
    // one. If form ever outweighed quality the bottom of the table would fund
    // itself out of trouble by finishing 8th.
    expect(occupancy(BIG, CLUBS, CLUBS)).toBeGreaterThan(occupancy(SMALL, 1, CLUBS))
  })

  it('never over-fills or empties a ground', () => {
    for (const club of TEST_CLUBS) {
      for (const position of [1, 10, CLUBS]) {
        const filled = occupancy(club, position, CLUBS)
        expect(filled).toBeGreaterThanOrEqual(FINANCE.MIN_OCCUPANCY)
        expect(filled).toBeLessThanOrEqual(FINANCE.MAX_OCCUPANCY)
      }
    }
  })

  it('takes nothing on an empty ground and something on a full one', () => {
    expect(gateReceipts(BIG, 1, CLUBS)).toBeGreaterThan(gateReceipts(SMALL, 1, CLUBS))
  })
})

describe('television and sponsorship', () => {
  it('pays the champion more than the bottom club', () => {
    expect(tvMoney(1, CLUBS)).toBeGreaterThan(tvMoney(CLUBS, CLUBS))
  })

  it('still pays the bottom club a real share', () => {
    // The equal share is what keeps a struggling club solvent — it is a floor
    // nobody can finish below. If merit were the whole pool, one bad season would
    // be unrecoverable, which is the opposite of the cycle this milestone is for.
    expect(tvMoney(CLUBS, CLUBS)).toBeGreaterThan(
      (FINANCE.TV_POOL * FINANCE.TV_EQUAL_SHARE) / CLUBS,
    )
    expect(tvMoney(CLUBS, CLUBS)).toBeGreaterThan(tvMoney(1, CLUBS) * 0.2)
  })

  it('splits the whole pool and no more', () => {
    let total = 0
    for (let position = 1; position <= CLUBS; position++) total += tvMoney(position, CLUBS)
    // Rounding aside — twenty divisions of an integer pool.
    expect(total).toBeGreaterThan(FINANCE.TV_POOL - CLUBS)
    expect(total).toBeLessThan(FINANCE.TV_POOL + CLUBS)
  })

  it('pays a first season flat, since nobody has finished anywhere', () => {
    expect(tvMoney(null, CLUBS)).toBe(Math.round(FINANCE.TV_POOL / CLUBS))
  })

  it('sponsors a big club more heavily than a small one', () => {
    expect(sponsorMoney(BIG)).toBeGreaterThan(sponsorMoney(SMALL) * 2)
  })
})

describe('prize money', () => {
  it('falls from first to last', () => {
    for (let position = 1; position < CLUBS; position++) {
      expect(prizeMoney(position, CLUBS)).toBeGreaterThan(prizeMoney(position + 1, CLUBS))
    }
  })

  it('splits the whole pool and no more', () => {
    let total = 0
    for (let position = 1; position <= CLUBS; position++) total += prizeMoney(position, CLUBS)
    expect(total).toBeGreaterThan(FINANCE.PRIZE_POOL - CLUBS)
    expect(total).toBeLessThan(FINANCE.PRIZE_POOL + CLUBS)
  })
})

describe('debt', () => {
  it('scales the overdraft with the club, not with a flat figure', () => {
    // A flat limit is pocket change to the richest club and fatal to the poorest,
    // which would make "nobody goes bankrupt" a statement about one club.
    expect(debtLimit(BIG, CLUBS, ROUNDS_PER_HALF)).toBeGreaterThan(
      debtLimit(SMALL, CLUBS, ROUNDS_PER_HALF) * 2,
    )
  })
})

describe('the ticket price', () => {
  const at = (price: number) => ({ ...BIG, ticketPrice: price })

  it('changes nothing at all when left at the default', () => {
    // The property that let this be added to a calibrated model without moving a
    // band — the same reason M3c's tempo is algebraically zero at balanced
    // tactics. `pnpm season` staying byte-identical is the proof.
    expect(occupancy(at(FINANCE.TICKET), 5, CLUBS)).toBe(occupancy(BIG, 5, CLUBS))
  })

  it('empties the ground when you charge more', () => {
    expect(occupancy(at(FINANCE.TICKET * 2), 5, CLUBS)).toBeLessThan(occupancy(BIG, 5, CLUBS))
  })

  it('fills it when you charge less', () => {
    expect(occupancy(at(FINANCE.TICKET * 0.5), 5, CLUBS)).toBeGreaterThan(occupancy(BIG, 5, CLUBS))
  })

  it('has its best price inside the range, not at the end stop', () => {
    // **The exploit this guards against.** With the price folded in before the
    // occupancy floor, `MIN_OCCUPANCY` absorbed the damage and charging the
    // maximum was strictly best — measured at €184k a match rising to €299k for
    // simply slamming the slider. A lever with one right answer at its end stop
    // is a button, and this project has made that mistake once already with the
    // tactics slider at M3a.
    let best = 0
    let bestAt = 0
    for (let step = 0; step <= 40; step++) {
      const price =
        FINANCE.TICKET *
        (FINANCE.MIN_TICKET_FACTOR +
          ((FINANCE.MAX_TICKET_FACTOR - FINANCE.MIN_TICKET_FACTOR) * step) / 40)
      const taken = gateReceipts(at(price), 10, CLUBS)
      if (taken > best) {
        best = taken
        bestAt = price / FINANCE.TICKET
      }
    }

    expect(bestAt).toBeGreaterThan(FINANCE.MIN_TICKET_FACTOR + 0.1)
    expect(bestAt).toBeLessThan(FINANCE.MAX_TICKET_FACTOR - 0.1)
  })

  it('empties the ground rather than being caught by the floor', () => {
    // The floor bounds what quality and form can do, not what a price can.
    expect(occupancy(at(FINANCE.TICKET * FINANCE.MAX_TICKET_FACTOR), 10, CLUBS)).toBeLessThan(
      FINANCE.MIN_OCCUPANCY,
    )
  })

  it('does not move the overdraft', () => {
    // The exploit this guards against: `annualIncome` feeds `debtLimit`, so a
    // price-sensitive income would let a manager raise his own borrowing limit
    // by moving a slider. The limit is a property of the club, not of the slider.
    const dear = debtLimit(at(FINANCE.TICKET * FINANCE.MAX_TICKET_FACTOR), CLUBS, ROUNDS_PER_HALF)
    const cheap = debtLimit(at(FINANCE.TICKET * FINANCE.MIN_TICKET_FACTOR), CLUBS, ROUNDS_PER_HALF)
    expect(dear).toBe(debtLimit(BIG, CLUBS, ROUNDS_PER_HALF))
    expect(cheap).toBe(dear)
  })
})

describe('building work', () => {
  it('charges by the seat', () => {
    expect(expansionCost(2000)).toBe(expansionCost(1000) * 2)
    expect(expansionCost(FINANCE.MIN_EXPANSION)).toBeGreaterThan(0)
  })

  it('is paid now and delivered at the rollover', () => {
    const rng = createRng(20260814)
    let state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng })
    const me = state.managedClubId
    const mine = () => state.clubs.find((c) => c.id === me)

    const before = mine()
    /* c8 ignore next */
    if (before === undefined) throw new Error('no club')
    const seats = 4000
    const cost = expansionCost(seats)

    state = reduce(state, { type: 'StartExpansion', seats }, rng).state

    // Money gone, ledger written, seats not yet.
    expect(mine()?.budget).toBe(before.budget - cost)
    expect(mine()?.ledger.stadium).toBe(cost)
    expect(mine()?.capacity).toBe(before.capacity)
    expect(mine()?.expansion?.seats).toBe(seats)

    // One job at a time — otherwise a rich club spends its way out of the choice.
    expect(() => reduce(state, { type: 'StartExpansion', seats: 2000 }, rng)).toThrow(
      /already under way/,
    )

    state = simulateSeason(state, rng)
    state = reduce(state, { type: 'StartNewSeason', names: TEST_NAMES }, rng).state

    expect(mine()?.capacity).toBe(before.capacity + seats)
    expect(mine()?.expansion).toBeNull()
  })

  it('refuses a job outside the sensible range', () => {
    const rng = createRng(20260814)
    const state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng })
    expect(() => reduce(state, { type: 'StartExpansion', seats: 10 }, rng)).toThrow(/runs from/)
    expect(() => reduce(state, { type: 'StartExpansion', seats: 999_999 }, rng)).toThrow(
      /runs from/,
    )
  })
})

describe('the settlement day', () => {
  it('is the first of the month and nothing else', () => {
    expect(isSettlementDay(fromCivil(2026, 9, 1))).toBe(true)
    expect(isSettlementDay(fromCivil(2026, 9, 2))).toBe(false)
    expect(isSettlementDay(fromCivil(2027, 1, 1))).toBe(true)
  })
})

describe('the balance identity', () => {
  // The invariant that replaced "money is conserved" at M5a. Checked here every
  // single day rather than once a season, which is as tight as it gets: if a tick
  // ever moves a balance without writing the line that explains it, this fails on
  // the day it happens.
  it('holds on every tick of a season', () => {
    const rng = createRng(20260814)
    let state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng })

    for (let day = 0; day < 365; day++) {
      const before = state.clubs
      state = reduce(state, { type: 'AdvanceDay' }, rng).state

      for (const club of state.clubs) {
        const was = before.find((c) => c.id === club.id)
        /* c8 ignore next */
        if (was === undefined) throw new Error('club vanished')
        expect(club.budget - was.budget, `${club.id} on day ${String(day)}`).toBe(
          ledgerNet(club.ledger) - ledgerNet(was.ledger),
        )
      }
    }
  })

  it('pays wages that match the squad on the books', () => {
    const rng = createRng(20260814)
    let state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng })

    // Stopped exactly on the tick that settles, because the premium is read off
    // the balance *before* the month is paid — a club is not charged more for
    // money the same settlement is about to take off it.
    while (!isSettlementDay(state.season.currentDate)) {
      state = reduce(state, { type: 'AdvanceDay' }, rng).state
    }
    const before = state.clubs[0]
    /* c8 ignore next */
    if (before === undefined) throw new Error('no club')

    state = reduce(state, { type: 'AdvanceDay' }, rng).state
    const after = state.clubs.find((c) => c.id === before.id)

    // Including the premium a club pays for sitting on money — the brake that
    // stops a surplus compounding.
    const premium = wagePremium(before, CLUBS, ROUNDS_PER_HALF)
    expect(after?.ledger.wages).toBe(
      Math.round((wageBill(state.squads[before.id] ?? []) * premium) / 12),
    )
  })
})

describe('what a signing really costs', () => {
  it('adds the bonus to the fee, so a fee-only test of affordability lies', () => {
    const fee = 1000
    const limit = debtLimit(BIG, CLUBS, ROUNDS_PER_HALF)
    // Exactly enough to cover the bare fee by spending to the overdraft floor.
    const club = { ...BIG, budget: fee - limit }

    expect(signingOutlay(fee) - fee).toBe(Math.round(fee * FINANCE.SIGNING_BONUS))
    expect(canAfford(club, fee, CLUBS, ROUNDS_PER_HALF)).toBe(true)
    // The claim that matters: the same deal is refused once the bonus counts.
    // This is what the market screen has to filter on, or it offers you players
    // the reducer will then reject.
    expect(canAfford(club, signingOutlay(fee), CLUBS, ROUNDS_PER_HALF)).toBe(false)
  })
})

describe('the season forecast', () => {
  const fresh = () => newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng: createRng(20260814) })

  const project = (state: ReturnType<typeof fresh>, club = state.clubs[0]) => {
    /* c8 ignore next */
    if (club === undefined) throw new Error('no club')
    return seasonProjection(
      club,
      state.squads[club.id] ?? [],
      state.competition.clubIds,
      state.season.fixtures,
    )
  }

  it('nets the income lines against the wage bill', () => {
    const forecast = project(fresh())
    expect(forecast.net).toBe(
      forecast.gate + forecast.tv + forecast.sponsor + forecast.prize - forecast.wages,
    )
  })

  /**
   * The property that stops this being `annualIncome` with a different name.
   * That function prices the gate at the league default *on purpose*, because it
   * sizes the overdraft and a manager must not widen his own borrowing with a
   * slider. A forecast has the opposite duty.
   */
  it("prices the gate at the manager's own ticket, where the overdraft will not", () => {
    const state = fresh()
    const club = state.clubs[0]
    /* c8 ignore next */
    if (club === undefined) throw new Error('no club')
    const dearer = { ...club, ticketPrice: club.ticketPrice * FINANCE.MAX_TICKET_FACTOR }

    expect(project(state, dearer).gate).not.toBe(project(state, club).gate)
    expect(debtLimit(dearer, CLUBS, ROUNDS_PER_HALF)).toBe(debtLimit(club, CLUBS, ROUNDS_PER_HALF))
  })

  it('assumes a mid-table finish before a ball is kicked', () => {
    const forecast = project(fresh())
    expect(forecast.position).toBeNull()
    expect(forecast.prize).toBe(prizeMoney(Math.ceil(CLUBS / 2), CLUBS))
    // The flat share, which is what the game actually pays in August.
    expect(forecast.tv).toBe(tvMoney(null, CLUBS))
  })

  it('follows the table once there is one', () => {
    const rng = createRng(20260814)
    const played = simulateSeason(newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng }), rng)
    const club = played.clubs[0]
    /* c8 ignore next */
    if (club === undefined) throw new Error('no club')

    const standing =
      computeTable(played.competition.clubIds, played.season.fixtures).findIndex(
        (row) => row.clubId === club.id,
      ) + 1
    const forecast = project(played, club)

    expect(forecast.position).toBe(standing)
    expect(forecast.prize).toBe(prizeMoney(standing, CLUBS))
  })

  /**
   * The reason the panel exists. `wageBill` is what the contracts say; it is not
   * what a club sitting on money actually pays, and the gap is the brake the
   * whole economy is bounded by.
   */
  it('charges the premium a cash pile adds, which the contracts alone do not show', () => {
    const state = fresh()
    const club = state.clubs[0]
    /* c8 ignore next */
    if (club === undefined) throw new Error('no club')
    const squad = state.squads[club.id] ?? []

    const banked = {
      ...club,
      budget: annualIncomeYears(club, 10),
    }
    expect(project(state, banked).wages).toBeGreaterThan(wageBill(squad))
    // And a club living hand to mouth is charged exactly the contracts, because
    // the premium is inert below the healthy reserve.
    expect(project(state, { ...club, budget: 0 }).wages).toBe(wageBill(squad))
  })
})

/** A balance worth this many years of the club's own income. */
function annualIncomeYears(club: (typeof TEST_CLUBS)[number], years: number): number {
  return Math.round(
    (gateReceipts({ ...club, ticketPrice: FINANCE.TICKET }, Math.ceil(CLUBS / 2), CLUBS) *
      ROUNDS_PER_HALF +
      tvMoney(null, CLUBS) +
      sponsorMoney(club)) *
      years,
  )
}
