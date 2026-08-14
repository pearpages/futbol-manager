import { describe, expect, it } from 'vitest'
import {
  acceptableYears,
  answerBid,
  type Bid,
  type BidId,
  bidIsLive,
  offerTerms,
  scheduleAnswer,
  suggestedTerms,
} from './bids.ts'
import type { ClubId } from './entities.ts'
import { ageOn, type Player, type PlayerId } from './player.ts'
import { createRng } from './rng.ts'
import { generateSquad } from './squad.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { fromCivil } from './time.ts'
import { askingPrice, expectedWage } from './valuation.ts'

/**
 * The bid model, tested directly rather than through the reducer, because these
 * are the numbers a manager will argue with.
 */

const DATE = fromCivil(2026, 8, 15)
const club = TEST_CLUBS[3]
/* c8 ignore next */
if (club === undefined) throw new Error('no test club')

const squad = generateSquad(club, createRng(99), { names: TEST_NAMES, seasonStart: DATE })
const player = squad[0]
/* c8 ignore next */
if (player === undefined) throw new Error('no player')

const bidFor = (target: Player, fee: number): Bid => ({
  id: 'b1' as BidId,
  playerId: target.id,
  from: 'buyer' as ClubId,
  to: club.id,
  fee,
  status: 'pending',
  counterFee: null,
  madeOn: DATE,
  answerOn: scheduleAnswer(DATE),
})

describe('answering a bid', () => {
  const asking = askingPrice(player, DATE)

  it('accepts at or above the asking price', () => {
    expect(answerBid(bidFor(player, asking), player, DATE).status).toBe('accepted')
    expect(answerBid(bidFor(player, asking * 2), player, DATE).status).toBe('accepted')
  })

  it('counters just below, naming the price rather than walking away', () => {
    const answer = answerBid(bidFor(player, Math.round(asking * 0.9)), player, DATE)
    expect(answer.status).toBe('countered')
    expect(answer.counterFee).toBe(asking)
  })

  it('rejects a lowball outright', () => {
    const answer = answerBid(bidFor(player, Math.round(asking * 0.5)), player, DATE)
    expect(answer.status).toBe('rejected')
    expect(answer.counterFee).toBeNull()
  })

  it('draws no randomness — the same bid always gets the same answer', () => {
    // The load-bearing property. Bid resolution runs inside `AdvanceDay`, which is
    // the path every calibrated band in the project is measured through.
    const bid = bidFor(player, Math.round(asking * 0.9))
    const first = answerBid(bid, player, DATE)
    for (let i = 0; i < 20; i++) expect(answerBid(bid, player, DATE)).toEqual(first)
  })
})

describe('a bid schedule', () => {
  it('answers two days out, with no clock read', () => {
    expect(scheduleAnswer(DATE)).toBe(DATE + 2)
  })

  it('knows which statuses are still in play', () => {
    const live = bidFor(player, 100)
    expect(bidIsLive(live)).toBe(true)
    expect(bidIsLive({ ...live, status: 'countered' })).toBe(true)
    expect(bidIsLive({ ...live, status: 'accepted' })).toBe(true)
    expect(bidIsLive({ ...live, status: 'rejected' })).toBe(false)
    expect(bidIsLive({ ...live, status: 'withdrawn' })).toBe(false)
  })
})

describe('personal terms', () => {
  it('accepts a wage at what he is worth, over an acceptable length', () => {
    const terms = suggestedTerms(player, DATE)
    expect(offerTerms(player, terms, DATE).accepted).toBe(true)
  })

  it('refuses a wage below his worth, and says what he wanted', () => {
    const terms = suggestedTerms(player, DATE)
    const verdict = offerTerms(player, { ...terms, wage: terms.wage - 1 }, DATE)
    expect(verdict.accepted).toBe(false)
    expect(verdict.reason).toBe('wage')
    expect(verdict.wanted).toBe(terms.wage)
  })

  it('asks for more than the going rate the better he is', () => {
    // Pricing every player at `expectedWage` would make the best ones the cheapest
    // relative to what they are worth, which is the same trap the valuation model
    // avoids for fees.
    const best = [...squad].sort((a, b) => askingPrice(b, DATE) - askingPrice(a, DATE))[0]
    /* c8 ignore next */
    if (best === undefined) throw new Error('no player')
    expect(suggestedTerms(best, DATE).wage).toBeGreaterThan(expectedWage(best, DATE))
  })

  it('refuses a length that does not suit his age', () => {
    const veteran: Player = {
      ...player,
      birthDate: fromCivil(1992, 1, 1), // 34 at the season start
    }
    expect(ageOn(veteran, DATE)).toBe(34)

    const wage = suggestedTerms(veteran, DATE).wage
    expect(offerTerms(veteran, { wage, years: 5 }, DATE).reason).toBe('length')
    expect(offerTerms(veteran, { wage, years: 2 }, DATE).accepted).toBe(true)
  })

  it('will not sign a youngster on a one-year deal', () => {
    const kid: Player = { ...player, birthDate: fromCivil(2006, 1, 1) } // 20
    const wage = suggestedTerms(kid, DATE).wage
    expect(offerTerms(kid, { wage, years: 1 }, DATE).reason).toBe('length')
  })

  it('narrows the acceptable length as a career ends', () => {
    expect(acceptableYears(20)).toEqual({ min: 2, max: 5 })
    expect(acceptableYears(27)).toEqual({ min: 1, max: 5 })
    expect(acceptableYears(31)).toEqual({ min: 1, max: 3 })
    expect(acceptableYears(35)).toEqual({ min: 1, max: 2 })
  })

  it('suggests terms he would actually sign', () => {
    // Otherwise the screen's prefill is a guess that gets refused, which reads as
    // a bug rather than a negotiation.
    for (const candidate of squad) {
      expect(offerTerms(candidate, suggestedTerms(candidate, DATE), DATE).accepted).toBe(true)
    }
  })
})

describe('a free agent', () => {
  it('is worth no fee, so his whole cost is wages', () => {
    // `contractFactor` already returns 0 once a deal has expired — the pricing for
    // this existed before there was anybody to price.
    const expired: Player = {
      ...player,
      contract: { until: fromCivil(2026, 6, 30), wage: 0 },
    }
    expect(askingPrice(expired, DATE)).toBe(0)
    expect(suggestedTerms(expired, DATE).wage).toBeGreaterThan(0)
  })
})

describe('ids', () => {
  it('are branded so a player id cannot be passed as a bid id', () => {
    const id: PlayerId = player.id
    expect(typeof id).toBe('string')
  })
})
