import type { TeamRating } from './entities.ts'
import {
  type Attributes,
  clampRating,
  overall,
  type Player,
  type PlayerId,
  type Position,
} from './player.ts'

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
const SLIDER_SWING = 3.99

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
 *
 * The weights are records rather than literals inside the two functions because
 * the ficha states them on screen. Restating a calibrated number as prose in a
 * dictionary is how the display and the model drift apart; there is one copy, and
 * `lineup.test.ts` pins it to the arithmetic these functions used to spell out.
 *
 * Iteration order is the declaration order, and the accumulation is left to right,
 * which is exactly the association the old expressions had — so the sum is
 * bit-identical and every calibrated band is untouched.
 */
export const ATTACK_WEIGHTS: Readonly<Partial<Attributes>> = {
  finishing: 0.35,
  dribbling: 0.25,
  passing: 0.2,
  pace: 0.12,
  heading: 0.08,
}

export const DEFENCE_WEIGHTS: Readonly<Partial<Attributes>> = {
  tackling: 0.4,
  heading: 0.25,
  pace: 0.2,
  stamina: 0.15,
}

function weighted(attributes: Attributes, weights: Readonly<Partial<Attributes>>): number {
  let total = 0
  for (const [key, weight] of Object.entries(weights) as [keyof Attributes, number][]) {
    total += weight * attributes[key]
  }
  return total
}

export function playerAttack(player: Player): number {
  if (player.position === 'GK') return 0
  return weighted(player.attributes, ATTACK_WEIGHTS)
}

export function playerDefence(player: Player): number {
  if (player.position === 'GK') return player.attributes.keeping
  return weighted(player.attributes, DEFENCE_WEIGHTS)
}

/** Step 2 — how much a slot's rating counts toward the team number. */
export const ATTACK_SHARE: Readonly<Record<Position, number>> = { GK: 0, DF: 0.15, MF: 0.45, FW: 1 }
export const DEFENCE_SHARE: Readonly<Record<Position, number>> = { GK: 0, DF: 1, MF: 0.5, FW: 0.15 }

/** The keeper alone carries this much of the defensive rating. */
export const KEEPER_WEIGHT = 0.35

/**
 * What share of each **team** number one player in this slot owns, given a shape.
 *
 * The weights above say how much a slot counts relative to the others; this is
 * what that works out to once the XI is filled — the numbers published in
 * docs/attribute-model.md's "shares, as percentages" table, which is what a person
 * can actually reason with. A goalkeeper reads 35% of the defence on his own,
 * which is the model's least obvious and most load-bearing property.
 *
 * Presentation asks for it, but the arithmetic belongs beside `teamRating`: it is
 * the same weighted mean read backwards, and derived anywhere else it would be a
 * second copy of the model.
 */
export function positionShare(
  position: Position,
  formation: Formation,
): { readonly attack: number; readonly defence: number } {
  const shape = FORMATIONS[formation]
  let attackTotal = 0
  let defenceTotal = 0

  for (const slot of ['DF', 'MF', 'FW'] as const) {
    attackTotal += shape[slot] * ATTACK_SHARE[slot]
    defenceTotal += shape[slot] * DEFENCE_SHARE[slot]
  }

  if (position === 'GK') return { attack: 0, defence: KEEPER_WEIGHT }

  return {
    attack: attackTotal > 0 ? ATTACK_SHARE[position] / attackTotal : 0,
    defence: defenceTotal > 0 ? ((1 - KEEPER_WEIGHT) * DEFENCE_SHARE[position]) / defenceTotal : 0,
  }
}

/**
 * The same collapse, **unrounded**.
 *
 * `needFor` scores marginal signings by subtracting two team ratings, and rounding
 * each before subtracting quantises the answer to whole points — which is what once
 * made four separately-written market thresholds all mean "at least one". It matters
 * more since the rating scale compressed, because every marginal gain shrank with it.
 *
 * Kept as a separate entry point rather than an extra field on `TeamRating`:
 * `teamRating` is one of the hottest functions here — `bestXI`, `needFor` and every
 * resolved fixture go through it — and returning a nested object on every call cost
 * enough allocation to push the tactics harness past its timeout.
 */
export function teamRatingRaw(
  starters: readonly Player[],
  tactics: Tactics = BALANCED,
): TeamRating {
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

  // `raw` keeps the unrounded pair. `needFor` scores marginal signings off it,
  // because rounding a *difference* of two rounded numbers is what made four
  // separately-written market thresholds all collapse to "at least one point".
  return {
    attack: attack + attackShift,
    defence: defence + defenceShift,
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

/**
 * True when a stored XI is still legal against this squad — nobody sold, nobody
 * retired out of it.
 *
 * The question a manager's team sheet raises: an AI club can simply be handed
 * `bestXI` whenever its squad changes, but doing that to the human silently undoes
 * a selection he made on purpose. So his is rebuilt only once it has actually
 * become impossible to field.
 */
export function keepsLineup(squad: readonly Player[], lineup: Lineup | undefined): boolean {
  if (lineup === undefined) return false
  try {
    startersOf(squad, lineup)
    return true
  } catch {
    return false
  }
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

/** The collapse the resolver consumes: whole numbers, clamped to 1–99. */
export function teamRating(starters: readonly Player[], tactics: Tactics = BALANCED): TeamRating {
  const raw = teamRatingRaw(starters, tactics)
  return { attack: clampRating(raw.attack), defence: clampRating(raw.defence), tempo: raw.tempo }
}
