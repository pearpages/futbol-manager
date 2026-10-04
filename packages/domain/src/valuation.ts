import {
  ageOn,
  type Contract,
  contractExpiry,
  contractMonthsLeft,
  overall,
  type Player,
  type Position,
} from './player.ts'
import type { Rng } from './rng.ts'
import { type DayNumber, toCivil } from './time.ts'

/**
 * What a player is worth, in thousands.
 *
 * Three factors, and the third is the one that is easy to get wrong.
 *
 * **Quality** is steeply convex. The gap between a 70 and an 80 is far larger than
 * between a 50 and a 60, because only the top of the market wins you anything —
 * a linear price curve makes squad-filling as efficient as star-buying, and the
 * whole market flattens.
 *
 * **Age** peaks in the mid-twenties. A 32-year-old is a depreciating asset however
 * good he is; an 18-year-old carries a premium for what he might become.
 *
 * **Contract time remaining** is most of the rest. Six months left and he walks
 * for nothing, so nobody pays a fee — which is what makes renewals matter.
 */

/** Thousands, for a 50-rated peak-age player on a long contract. */
const BASE_VALUE = 1_200

/**
 * Position scarcity, from measured league-point impact rather than taste.
 * See docs/attribute-model.md#what-actually-moves-results — upgrading one starter
 * to 90 is worth +10.5 points at goalkeeper against +4.1 for a defender, because
 * 35% of a team's defensive rating rests on one player.
 *
 * **Pricing on `overall` alone would systematically underprice keepers**, and a
 * human would empty the league of them. The multipliers are damped rather than
 * proportional to impact: a market that priced a keeper at 2.5× would make him
 * unbuyable for anyone but the richest club, which is its own distortion.
 */
const SCARCITY: Readonly<Record<Position, number>> = {
  GK: 1.45,
  DF: 1.0,
  MF: 0.95,
  FW: 1.1,
}

/** Age multiplier. Peaks 24–27, premium on youth, steep decline after 30. */
function ageFactor(age: number): number {
  if (age <= 18) return 1.25
  if (age <= 21) return 1.3
  if (age <= 23) return 1.2
  if (age <= 27) return 1.0
  if (age <= 29) return 0.8
  if (age <= 31) return 0.55
  if (age <= 33) return 0.3
  return 0.15
}

/**
 * Contract multiplier. A player inside six months of expiry costs almost nothing
 * because he is about to be free; a long deal means the selling club can hold out.
 */
function contractFactor(monthsLeft: number): number {
  if (monthsLeft <= 0) return 0
  if (monthsLeft < 6) return 0.25
  if (monthsLeft < 12) return 0.55
  if (monthsLeft < 24) return 0.85
  return 1
}

/**
 * Where the price curve is anchored, in rating points.
 *
 * A player on `RATING_FLOOR + RATING_UNIT` — that is, **69.54** — prices at exactly
 * `BASE_VALUE`. Everything above costs disproportionately more and everything below
 * disproportionately less, which is the convexity that keeps a superstar out of a
 * small club's reach.
 *
 * **These two numbers exist because the rating scale was renumbered, and they are how
 * the renumbering was made free.** This used to read `Math.pow(rating / 50, 3.2)` —
 * fifty being "average" on a 1–99 scale where the typical Primera player came out at
 * 59 and half the league was under 60. The scale now runs 60–94, so a bare `/50` would
 * have multiplied every squad player's fee and wage by more than three, silently:
 * nothing in the suite asserts an absolute price.
 *
 * So the curve is expressed against the *same point in the distribution* it always
 * was. `RATING_FLOOR` is where the old scale's zero landed and `RATING_UNIT` is what
 * fifty of its points are worth now. **Read as: the arithmetic is unchanged, only its
 * units are.** The same pair appears in `seedBudget` and `sponsorMoney`, and a
 * different pivot on the same footing in `wageDemand` — change one, change all four.
 */
const RATING_FLOOR = 45.08
const RATING_UNIT = 24.96

/** Quality multiplier. Convex, so the top of the market costs disproportionately. */
function qualityFactor(rating: number): number {
  return Math.pow((rating - RATING_FLOOR) / RATING_UNIT, 3.2)
}

/**
 * What he is worth on the pitch, before anything about his contract.
 *
 * Split out at M4c because a **fee** and a **wage** depend on the contract in
 * opposite directions, and deriving both from one number got the wage badly wrong.
 */
function playerWorth(player: Player, date: DayNumber): number {
  return (
    BASE_VALUE *
    qualityFactor(overall(player)) *
    ageFactor(ageOn(player, date)) *
    SCARCITY[player.position]
  )
}

export function valuePlayer(player: Player, date: DayNumber): number {
  return Math.round(playerWorth(player, date) * contractFactor(contractMonthsLeft(player, date)))
}

/**
 * What a club must be paid to part with a player, as opposed to what he is worth.
 * Selling clubs hold out for a premium; without one, squads churn every window.
 */
export function askingPrice(player: Player, date: DayNumber): number {
  return Math.round(valuePlayer(player, date) * 1.35)
}

/**
 * Annual wage a player of this quality expects, in thousands.
 *
 * **Deliberately ignores how long his contract has left**, which `valuePlayer`
 * does not. A fee collapses as a deal runs down — six months left and he walks for
 * nothing — but a wage does not: a player out of contract wants *more*, not a
 * token. Deriving this from `valuePlayer` meant `contractFactor` returned 0 for
 * exactly the players whose terms were being decided, so every renewal in
 * `rolloverSeason` and every free agent came out on the 50 floor. It also made a
 * free agent look costless to the AI, which took one every window and never bought
 * anybody with a price on his head.
 */
export function expectedWage(player: Player, date: DayNumber): number {
  return Math.max(50, Math.round(playerWorth(player, date) * 0.22))
}

/**
 * Renders a money figure. Every number in this module is **thousands**, which is
 * exactly the sort of unit that gets displayed raw once and then misread forever.
 *
 * Lives here rather than in the app for the same reason `formatDate` lives in
 * `time.ts`: the unit is a property of the value, so the function that knows the
 * unit should be the one that prints it.
 */
export function formatMoney(thousands: number): string {
  const value = Math.round(thousands)
  if (Math.abs(value) >= 1000) {
    // Millions to one decimal — 12.4M reads at a glance where 12,350k does not.
    const millions = value / 1000
    const text = Math.abs(millions) >= 100 ? millions.toFixed(0) : millions.toFixed(1)
    return `€${text.replace(/\.0$/, '')}M`
  }
  return `€${value}k`
}

/**
 * How long a renewal runs, by age. Clubs commit long to players entering their
 * peak and short to those leaving it, which is what stops a league silently
 * filling with thirty-somethings on five-year deals.
 */
function renewalYears(age: number, rng: Rng): number {
  if (age <= 23) return 3 + Math.floor(rng.next() * 2)
  if (age <= 29) return 2 + Math.floor(rng.next() * 3)
  if (age <= 32) return 1 + Math.floor(rng.next() * 2)
  return 1
}

/**
 * The new deal a club gives a player it keeps at the rollover, on the season
 * opening on `start`.
 *
 * One function for home and abroad, so the two leagues renew the same way. Abroad
 * used to renew nobody: a lapsed contract prices a player at 0, so half the
 * foreign league could be signed for a fee of 1 within three seasons.
 */
export function renewedContract(player: Player, start: DayNumber, rng: Rng): Contract {
  return {
    until: contractExpiry(toCivil(start).y + renewalYears(ageOn(player, start), rng)),
    wage: expectedWage(player, start),
  }
}
