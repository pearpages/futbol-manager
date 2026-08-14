import { ageOn, contractMonthsLeft, overall, type Player, type Position } from './player.ts'
import type { DayNumber } from './time.ts'

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

/** Quality multiplier. Convex, so the top of the market costs disproportionately. */
function qualityFactor(rating: number): number {
  return Math.pow(rating / 50, 3.2)
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
