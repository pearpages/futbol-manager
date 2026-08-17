import { type DayNumber, fromCivil, toCivil } from './time.ts'

/**
 * The player model. Implements docs/attribute-model.md exactly — that document is
 * the spec, so a change belongs there first and here second.
 *
 * Eight attributes, not thirty (ADR 0004). Each has to be visibly load-bearing,
 * since a player can read all eight at once.
 */

export type PlayerId = string & { readonly __playerId: unique symbol }

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

export interface Attributes {
  readonly pace: number
  readonly finishing: number
  readonly passing: number
  readonly dribbling: number
  readonly tackling: number
  readonly heading: number
  readonly keeping: number
  readonly stamina: number
}

export const ATTRIBUTE_KEYS = [
  'pace',
  'finishing',
  'passing',
  'dribbling',
  'tackling',
  'heading',
  'keeping',
  'stamina',
] as const satisfies readonly (keyof Attributes)[]

/**
 * Terms a player is on. Added at M4 — a transfer means nothing if nobody is under
 * contract, and the length remaining is most of what a player is worth: six months
 * left and he walks for free, so he is cheap.
 */
export interface Contract {
  /** Expiry. Contracts run to 30 June, as they do in reality. */
  readonly until: DayNumber
  /** Per season. Paid monthly since M5a, a twelfth at a time, times the premium. */
  readonly wage: number
}

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly position: Position
  /**
   * Age is derived, never stored — the same reason the day clock is state. A
   * stored age would drift out of sync with the season the moment a save is
   * reloaded, and birthdays are what M6's age curve keys off.
   *
   * It is also why a season rollover ages everybody for free.
   */
  readonly birthDate: DayNumber
  readonly attributes: Attributes
  readonly contract: Contract
}

/** Months left to run. Negative once expired. */
export function contractMonthsLeft(player: Player, date: DayNumber): number {
  return (player.contract.until - date) / 30.44
}

/**
 * Contracts run to 30 June, as they do in reality.
 *
 * Lives here rather than in `season.ts` — its original home — because it
 * describes a contract, and both the market and the rollover need it. Leaving it
 * in `season.ts` forced `market.ts` to import that module for one date, which
 * closed a cycle once the rollover started asking the market who was still wanted.
 */
export function contractExpiry(year: number): DayNumber {
  return fromCivil(year, 6, 30)
}

/**
 * True when this deal runs out at the end of the season starting in `startYear`.
 *
 * A contract always expires on a 30 June, and `rolloverSeason` decides who stays
 * by comparing against the *next* 15 August — so "his deal is up this season" is
 * exactly `until <= contractExpiry(startYear + 1)`. The comparison is `<=` rather
 * than `===` so that an already-expired deal, which no live career should hold,
 * still reads as expiring rather than as safe.
 */
export function expiresThisSeason(player: Player, startYear: number): boolean {
  return player.contract.until <= contractExpiry(startYear + 1)
}

/**
 * How far ahead a deal running out is announced — half a year, counted back from
 * the contract itself rather than from a calendar date.
 *
 * Lives beside the contract rather than in `reduce.ts` for the same reason
 * `WINDOW_WARNING_DAYS` lives beside the window predicate: the constant and the
 * thing it describes should not be able to drift apart.
 */
export const CONTRACT_WARNING_DAYS = 182

/**
 * Position weights from docs/attribute-model.md. Each row sums to exactly 1.00 —
 * a test asserts it, because a row that drifts changes every rating in the game
 * silently.
 */
export const POSITION_WEIGHTS: Readonly<Record<Position, Attributes>> = {
  GK: {
    pace: 0.05,
    finishing: 0.0,
    passing: 0.1,
    dribbling: 0.0,
    tackling: 0.05,
    heading: 0.05,
    keeping: 0.7,
    stamina: 0.05,
  },
  DF: {
    pace: 0.15,
    finishing: 0.03,
    passing: 0.15,
    dribbling: 0.05,
    tackling: 0.3,
    heading: 0.2,
    keeping: 0.0,
    stamina: 0.12,
  },
  MF: {
    pace: 0.1,
    finishing: 0.1,
    passing: 0.3,
    dribbling: 0.15,
    tackling: 0.15,
    heading: 0.02,
    keeping: 0.0,
    stamina: 0.18,
  },
  FW: {
    pace: 0.2,
    finishing: 0.32,
    passing: 0.1,
    dribbling: 0.18,
    tackling: 0.0,
    heading: 0.12,
    keeping: 0.0,
    stamina: 0.08,
  },
}

export function clampRating(value: number): number {
  return Math.min(99, Math.max(1, Math.round(value)))
}

/**
 * How good this player is **at their position** — a display and valuation number.
 * A keeper's `finishing` is worth nothing here and a striker's `tackling` likewise.
 *
 * This is deliberately *not* what the resolver consumes; see lineup.ts for the
 * collapse into a team's attack and defence.
 */
export function overall(player: Player): number {
  const weights = POSITION_WEIGHTS[player.position]
  let total = 0
  for (const key of ATTRIBUTE_KEYS) total += weights[key] * player.attributes[key]
  return clampRating(total)
}

/** Completed years as of `date`. Birthday not yet reached this year counts as a year less. */
export function ageOn(player: Player, date: DayNumber): number {
  const born = toCivil(player.birthDate)
  const now = toCivil(date)
  const hadBirthday = now.m > born.m || (now.m === born.m && now.d >= born.d)
  return now.y - born.y - (hadBirthday ? 0 : 1)
}
