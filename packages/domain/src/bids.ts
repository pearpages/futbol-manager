import type { ClubId } from './entities.ts'
import { ageOn, overall, type Player, type PlayerId } from './player.ts'
import { addDays, type DayNumber } from './time.ts'
import { askingPrice, expectedWage } from './valuation.ts'

/**
 * Bids, counter-bids and personal terms — the human's half of the market.
 *
 * M4a's `runTransferWindow` settles a whole window in one pass, which is right
 * for the AI and useless for a person: a manager needs to make an offer, wait,
 * and be told no. So a bid is *state* that lives across days, and this module is
 * the pure logic that answers one.
 *
 * **Nothing here draws randomness, and that is a hard requirement rather than a
 * stylistic one.** The M2/M3 distribution bands run through
 * `simulateSeasons → simulateSeason → reduce(AdvanceDay)`, and bid resolution
 * happens inside `AdvanceDay`. A single `rng.next()` here would shift every
 * downstream draw and move every calibrated band in the project. It is the same
 * constraint M3c's `tempo` satisfied by vanishing at balanced tactics: extend a
 * calibrated model only in ways that are inert when the new feature is unused.
 *
 * Every decision below is therefore a pure function of the players and the date.
 * The variety that randomness would have provided comes instead from squads
 * differing — which is plenty, and reproducible.
 */

export type BidId = string & { readonly __bidId: unique symbol }

/**
 * `agreed` is the fee being settled, not the deal being done — a transfer only
 * completes once personal terms are signed, which is a separate decision by a
 * separate party. Keeping the two apart is what makes "we agreed a fee but he
 * wouldn't come" expressible.
 */
export type BidStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn'

export interface Bid {
  readonly id: BidId
  readonly playerId: PlayerId
  /** The buying club. */
  readonly from: ClubId
  /** The selling club. */
  readonly to: ClubId
  readonly fee: number
  readonly status: BidStatus
  /** What the seller will take instead, when they counter. */
  readonly counterFee: number | null
  readonly madeOn: DayNumber
  /** When the answer lands. Fixed offset — see the no-randomness note above. */
  readonly answerOn: DayNumber
}

/**
 * Days a club takes to answer. Long enough that an offer is a commitment you
 * live with rather than a slot machine you pull until it says yes.
 */
export const ANSWER_DAYS = 2

/** An unanswered offer to the human lapses rather than accumulating forever. */
export const OFFER_LIFETIME_DAYS = 7

/**
 * Below asking, but close enough that the seller names its price instead of
 * walking away. Under this and they are not interested at all.
 */
const COUNTER_FLOOR = 0.8

export function bidIsLive(bid: Bid): boolean {
  return bid.status === 'pending' || bid.status === 'countered' || bid.status === 'accepted'
}

export interface BidAnswer {
  readonly status: BidStatus
  readonly counterFee: number | null
}

/**
 * What the selling club says. A comparison against `askingPrice`, which already
 * carries the seller's premium over `valuePlayer`.
 *
 * Deliberately not a haggling model: the player being bid for is on the seller's
 * surplus list, so they *want* him gone and the only question is the number.
 * Whether a club will part with a starter at all is decided upstream, by
 * `surplus` — which is the same reason there is no rule about goalkeepers.
 */
export function answerBid(bid: Bid, player: Player, date: DayNumber): BidAnswer {
  const asking = askingPrice(player, date)

  if (bid.fee >= asking) return { status: 'accepted', counterFee: null }
  if (bid.fee >= asking * COUNTER_FLOOR) return { status: 'countered', counterFee: asking }
  return { status: 'rejected', counterFee: null }
}

export function scheduleAnswer(madeOn: DayNumber): DayNumber {
  return addDays(madeOn, ANSWER_DAYS)
}

export interface Terms {
  /** Per season, in thousands. */
  readonly wage: number
  /** Contract length in years. */
  readonly years: number
}

export const MIN_CONTRACT_YEARS = 1
export const MAX_CONTRACT_YEARS = 5

/**
 * How much over the going rate a player of this quality expects. A 90 knows he
 * has options; a squad filler does not, and pricing both at `expectedWage` makes
 * the best players the cheapest relative to their worth.
 */
function wageDemand(player: Player): number {
  return 1 + Math.max(0, overall(player) - 60) / 100
}

/**
 * Length a player will sign. The shape mirrors `renewalYears` in `season.ts`:
 * a young player wants the security of a long deal and a 33-year-old will not be
 * offered — or accept — five more years.
 *
 * Returned as a range because both ends are refusals for different reasons: too
 * short is insecurity, too long at the wrong age is a career spent somewhere he
 * did not choose.
 */
export function acceptableYears(age: number): { min: number; max: number } {
  if (age <= 23) return { min: 2, max: 5 }
  if (age <= 29) return { min: 1, max: 5 }
  if (age <= 32) return { min: 1, max: 3 }
  return { min: 1, max: 2 }
}

export interface TermsVerdict {
  readonly accepted: boolean
  /** What he would sign for, so a screen can show a target rather than a guess. */
  readonly wanted: number
  readonly reason: 'agreed' | 'wage' | 'length'
}

/**
 * Whether a player signs. A scoring function against what he is worth, not a
 * rule tree — the same principle the AI market is built on.
 */
export function offerTerms(player: Player, terms: Terms, date: DayNumber): TermsVerdict {
  const wanted = Math.round(expectedWage(player, date) * wageDemand(player))
  const years = acceptableYears(ageOn(player, date))

  if (terms.years < years.min || terms.years > years.max) {
    return { accepted: false, wanted, reason: 'length' }
  }
  if (terms.wage < wanted) return { accepted: false, wanted, reason: 'wage' }

  return { accepted: true, wanted, reason: 'agreed' }
}

/** Suggested opening terms, so a screen can prefill rather than make you guess. */
export function suggestedTerms(player: Player, date: DayNumber): Terms {
  const years = acceptableYears(ageOn(player, date))
  return {
    wage: Math.round(expectedWage(player, date) * wageDemand(player)),
    years: Math.min(3, years.max),
  }
}
