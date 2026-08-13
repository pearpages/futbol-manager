import { type DayNumber, toCivil } from './time.ts'

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

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly position: Position
  /**
   * Age is derived, never stored — the same reason the day clock is state. A
   * stored age would drift out of sync with the season the moment a save is
   * reloaded, and birthdays are what M6's age curve keys off.
   */
  readonly birthDate: DayNumber
  readonly attributes: Attributes
}

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
