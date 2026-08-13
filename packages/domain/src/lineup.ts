import type { TeamRating } from './entities.ts'
import { clampRating, overall, type Player, type PlayerId, type Position } from './player.ts'

/**
 * Collapses a starting XI into the two numbers the resolver consumes.
 *
 * This is steps 1–4 of the contract in docs/attribute-model.md, and it is the
 * whole reason M2 took a `TeamRating` parameter: M3 replaces the supplier, and
 * `resolveFixture` is untouched.
 *
 * The collapse must round-trip club strength. A club whose provisional rating was
 * 88/85 must field a squad that collapses back to roughly 88/85, or M2's
 * calibration silently stops holding.
 */

export type Formation = '4-4-2' | '4-3-3' | '5-3-2' | '3-5-2'

/** Outfield shape by formation. Every formation implies exactly one goalkeeper. */
export const FORMATIONS: Readonly<Record<Formation, Readonly<Record<Position, number>>>> = {
  '4-4-2': { GK: 1, DF: 4, MF: 4, FW: 2 },
  '4-3-3': { GK: 1, DF: 4, MF: 3, FW: 3 },
  '5-3-2': { GK: 1, DF: 5, MF: 3, FW: 2 },
  '3-5-2': { GK: 1, DF: 3, MF: 5, FW: 2 },
}

export const FORMATION_NAMES = Object.keys(FORMATIONS) as Formation[]

export interface Lineup {
  readonly formation: Formation
  /** Exactly 11, exactly one of them a goalkeeper. */
  readonly starters: readonly PlayerId[]
}

/**
 * A single slider, 0–100, trading attack against defence. 50 is balanced, and both
 * directions cost more than they give — see `EXTREME_PENALTY`.
 *
 * One slider rather than five: ground rule 5 — a second tactical dimension waits
 * for a second case that needs it.
 */
export interface Tactics {
  readonly attacking: number
}

export const BALANCED: Tactics = { attacking: 50 }

/** How far the slider can shift the split, in rating points, at either extreme. */
const SLIDER_SWING = 8

/**
 * Extremes cost more than they give. Without this the slider is not a decision:
 * under three-points-for-a-win, converting a draw into a 50/50 win-or-loss is
 * worth +0.5 points on average, so a symmetric trade makes all-out attack strictly
 * optimal every week — measured at +2.1 points a season before this was added.
 *
 * Real football charges for the same thing, because defensive shape degrades
 * non-linearly rather than in proportion to how many players you push forward.
 * At either extreme you give up 1.6× what you gain.
 */
const EXTREME_PENALTY = 0.6

/**
 * Step 1 — per-player ratings. Attribute weights here are **position-independent**:
 * a defender who can finish contributes to attack, which is the point.
 */
export function playerAttack(player: Player): number {
  if (player.position === 'GK') return 0
  const a = player.attributes
  return (
    0.35 * a.finishing + 0.25 * a.dribbling + 0.2 * a.passing + 0.12 * a.pace + 0.08 * a.heading
  )
}

export function playerDefence(player: Player): number {
  const a = player.attributes
  if (player.position === 'GK') return a.keeping
  return 0.4 * a.tackling + 0.25 * a.heading + 0.2 * a.pace + 0.15 * a.stamina
}

/** Step 2 — how much a slot's rating counts toward the team number. */
const ATTACK_SHARE: Readonly<Record<Position, number>> = { GK: 0, DF: 0.15, MF: 0.45, FW: 1 }
const DEFENCE_SHARE: Readonly<Record<Position, number>> = { GK: 0, DF: 1, MF: 0.5, FW: 0.15 }

/** The keeper alone carries this much of the defensive rating. */
const KEEPER_WEIGHT = 0.35

export function teamRating(starters: readonly Player[], tactics: Tactics = BALANCED): TeamRating {
  const keeper = starters.find((p) => p.position === 'GK')
  const outfield = starters.filter((p) => p.position !== 'GK')

  if (keeper === undefined || outfield.length === 0) {
    throw new Error('A lineup needs a goalkeeper and at least one outfield player')
  }

  // Step 3 — weighted means over the XI.
  let attackWeighted = 0
  let attackShares = 0
  let defenceWeighted = 0
  let defenceShares = 0

  for (const player of outfield) {
    const attackShare = ATTACK_SHARE[player.position]
    const defenceShare = DEFENCE_SHARE[player.position]
    attackWeighted += attackShare * playerAttack(player)
    attackShares += attackShare
    defenceWeighted += defenceShare * playerDefence(player)
    defenceShares += defenceShare
  }

  const attack = attackShares > 0 ? attackWeighted / attackShares : 0
  const outfieldDefence = defenceShares > 0 ? defenceWeighted / defenceShares : 0
  const defence = (1 - KEEPER_WEIGHT) * outfieldDefence + KEEPER_WEIGHT * playerDefence(keeper)

  // Step 4.1 — the slider, which does two things at once.
  //
  // Split: what you gain is linear; what you give up grows with how far you push.
  // The penalty always applies to the side being *reduced*, in both directions —
  // apply it to the signed shift instead and going defensive gains more defence
  // than it costs attack, which is free strength.
  const lever = (tactics.attacking - 50) / 50 // −1 … +1
  const magnitude = Math.abs(lever) * SLIDER_SWING
  const surrendered = magnitude * (1 + Math.abs(lever) * EXTREME_PENALTY)

  const [attackShift, defenceShift] =
    lever >= 0 ? [magnitude, -surrendered] : [-surrendered, magnitude]

  return {
    attack: clampRating(attack + attackShift),
    defence: clampRating(defence + defenceShift),
    // Tempo: how open you want the game. The resolver averages both sides and
    // applies it to both scorelines, so a low block smothers the match rather
    // than only your half of it. Zero at balanced, which is what keeps the M2
    // calibration intact.
    tempo: lever,
  }
}

/**
 * Greedy best XI: fill each position slot with that position's highest `overall`.
 * Used by AI clubs every matchday and as the baseline the exit-criterion test
 * measures a deliberately bad lineup against.
 */
export function bestXI(squad: readonly Player[], formation: Formation): Lineup {
  return pickXI(squad, formation, (a, b) => overall(b) - overall(a))
}

/** The inverse — the weakest legal XI. Exists so "a bad lineup costs points" is testable. */
export function worstXI(squad: readonly Player[], formation: Formation): Lineup {
  return pickXI(squad, formation, (a, b) => overall(a) - overall(b))
}

function pickXI(
  squad: readonly Player[],
  formation: Formation,
  order: (a: Player, b: Player) => number,
): Lineup {
  const shape = FORMATIONS[formation]
  const starters: PlayerId[] = []

  for (const position of ['GK', 'DF', 'MF', 'FW'] as const) {
    const needed = shape[position]
    const available = squad.filter((p) => p.position === position).sort(order)

    if (available.length < needed) {
      throw new Error(`Squad has ${available.length} ${position}, formation needs ${needed}`)
    }
    for (const player of available.slice(0, needed)) starters.push(player.id)
  }

  return { formation, starters }
}

/** Resolves a lineup against a squad, rejecting anything that is not a legal XI. */
export function startersOf(squad: readonly Player[], lineup: Lineup): Player[] {
  const byId = new Map(squad.map((p) => [p.id, p]))
  const starters = lineup.starters.map((id) => {
    const player = byId.get(id)
    if (player === undefined) throw new Error(`Player ${id} is not in this squad`)
    return player
  })

  if (starters.length !== 11) throw new Error(`A lineup needs 11 players, got ${starters.length}`)
  const keepers = starters.filter((p) => p.position === 'GK').length
  if (keepers !== 1) throw new Error(`A lineup needs exactly one goalkeeper, got ${keepers}`)
  if (new Set(lineup.starters).size !== 11) throw new Error('A lineup cannot name a player twice')

  return starters
}
