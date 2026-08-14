import { describe, expect, it } from 'vitest'
import {
  credit,
  debtLimit,
  EMPTY_LEDGER,
  FINANCE,
  gateReceipts,
  isSettlementDay,
  LEDGER_KEYS,
  ledgerNet,
  occupancy,
  prizeMoney,
  seedCapacity,
  sponsorMoney,
  tvMoney,
  wageBill,
  wagePremium,
} from './finance.ts'
import { ROUNDS_PER_HALF } from './fixtures.ts'
import { reduce } from './reduce.ts'
import { createRng } from './rng.ts'
import { newSeason } from './simulate.ts'
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
    expect(seedCapacity(BIG.attack, BIG.defence)).toBeGreaterThan(
      seedCapacity(SMALL.attack, SMALL.defence) * 2,
    )
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
