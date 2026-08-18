import type { TeamRating } from './entities.ts'
import {
  type Attributes,
  clampRating,
  overall,
  type Player,
  type PlayerId,
  type Position,
  POSITIONS,
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

export type Formation =
  '4-4-2' | '4-3-3' | '5-3-2' | '3-5-2' | '4-5-1' | '5-4-1' | '3-4-3' | '4-2-4'

/**
 * Outfield shape by formation. Every formation implies exactly one goalkeeper.
 *
 * A formation here is *only* its bank counts, which is why 4-2-3-1 and 4-1-4-1
 * are absent: both are DF 4 / MF 5 / FW 1, indistinguishable from 4-5-1 without a
 * fifth bank. That absence is period-correct for the 1996/97 target — those shapes
 * belong to the 2000s — so the three banks are not costing anything yet.
 *
 * The original four come first: `FORMATION_NAMES` is `Object.keys`, and that order
 * is what the lineup screen renders, so the familiar shapes stay in the first row.
 */
export const FORMATIONS: Readonly<Record<Formation, Readonly<Record<Position, number>>>> = {
  '4-4-2': { GK: 1, DF: 4, MF: 4, FW: 2 },
  '4-3-3': { GK: 1, DF: 4, MF: 3, FW: 3 },
  '5-3-2': { GK: 1, DF: 5, MF: 3, FW: 2 },
  '3-5-2': { GK: 1, DF: 3, MF: 5, FW: 2 },
  '4-5-1': { GK: 1, DF: 4, MF: 5, FW: 1 },
  '5-4-1': { GK: 1, DF: 5, MF: 4, FW: 1 },
  '3-4-3': { GK: 1, DF: 3, MF: 4, FW: 3 },
  '4-2-4': { GK: 1, DF: 4, MF: 2, FW: 4 },
}

export const FORMATION_NAMES = Object.keys(FORMATIONS) as Formation[]

/**
 * How open each shape makes the game, on the same scale as the slider's tempo.
 *
 * **Why formation needs this at all.** Without it the defensive shapes are dead
 * buttons, and measurably so: over the real rosters 4-5-1 averaged −1.6 points and
 * was optimal at *none* of the twenty clubs, 5-4-1 −1.0. The cause is structural
 * rather than tuning — `ATTACK_SHARE.MF` is 0.45 and `DEFENCE_SHARE.MF` is 0.5, so
 * a midfielder is a half-contributor to both weighted means, and a shape that
 * trades forwards *and* defenders for midfielders dilutes both numbers at once.
 * Real football's 4-5-1 pays for that dilution by controlling the tempo, and until
 * now formation could not touch tempo.
 *
 * This is the M3a slider problem in a third costume — a lever whose defensive end
 * is strictly wrong — and M3c's fix is the one that applies: the resolver averages
 * both sides' tempo, so smothering the game is worth far more to the side that
 * would otherwise lose. That is what makes a low block a *choice* and not a cost.
 *
 * **4-4-2 is exactly zero**, which is what keeps every calibrated band and
 * `pnpm season` untouched — the same property M3c relied on. 3-5-2 is zero too:
 * five in midfield with two up front is the neutral shape it has always been.
 *
 * **The scale is asymmetric on purpose**, and it is not a fudge. An attacking
 * shape is already rewarded by bank concentration — more forwards is more attack
 * straight out of `ATTACK_SHARE` — so it needs only a nudge. A defensive shape is
 * *punished* by the same mechanism, so its tempo has to clear that debt before it
 * buys anything. Hence +0.4 at the attacking end against −0.7 at the defensive.
 *
 * Calibrated by measurement, over the real rosters at the default slider, and the
 * figures below are from the shipped league:
 *
 *     Madrid (88)     4-4-2 84.6   best 4-4-2 @ slider 100, 90.3   -> attacks
 *     A Coruña (74)   4-4-2 44.7   best 5-3-2 @ slider  50, 45.1   -> neither
 *     Málaga (70)     4-4-2 30.3   best 4-5-1 @ slider   0, 34.5   -> contains
 *
 * **The end-stop check that matters**, since formation and the slider share this
 * channel and can stack: the full low block corner (5-4-1 at slider 0) is best for
 * *nobody* — it ranks 23rd, 24th, 15th and 2nd of 24 cells at those four clubs.
 * Re-run that sweep if these move.
 *
 * **These figures cannot go much deeper, and that is a hard ceiling rather than
 * taste.** `formations.test.ts` requires every shape's tempo to stay inside the
 * slider's own ±1, so that a team sheet cannot out-swing a deliberate tactical
 * choice. That matters because the harness's weak-club arm — which asks a weak club
 * to *prefer* 4-5-1 — cannot be satisfied from here: measured on TEST_CLUBS the gain
 * is −0.8 at −0.6 and −1.6 at −1.0, and only clears the bar at −1.4 and beyond,
 * which the invariant forbids. **On the real league the mechanism already works at
 * the values below** (Málaga above, +4.2 for containing), so the gap is between the
 * shipped league and the generated squads the harness runs on, not in this table.
 * See the open item in `docs/roadmap.md`; do not "fix" it by deepening these.
 *
 * 4-5-1 is the milder containment; 5-4-1 gets both more defence and more
 * smothering.
 */
const FORMATION_TEMPO: Readonly<Record<Formation, number>> = {
  '4-4-2': 0,
  '3-5-2': 0,
  '4-3-3': 0.15,
  '3-4-3': 0.25,
  '4-2-4': 0.4,
  '5-3-2': -0.25,
  '4-5-1': -0.6,
  '5-4-1': -0.7,
}

/**
 * Packs a shape's outfield banks into one integer — `4-4-2` is 442.
 *
 * The shape is read off the players actually on the pitch rather than the
 * `formation` label on the lineup, for two reasons. `teamRatingRaw` takes starters
 * and tactics and has never taken the formation, so the label is not in scope; and
 * a `Lineup` can carry a label its banks do not match, because `setLineup` checks
 * the XI is legal but never that it matches its own declared shape. Deriving means
 * the tempo follows what is on the pitch, which is the honest answer either way.
 *
 * An integer key, not a template string: this is on the hot path that once pushed
 * the tactics harness past its timeout through allocation alone.
 */
const bankKey = (df: number, mf: number, fw: number) => df * 100 + mf * 10 + fw

const FORMATION_TEMPO_BY_BANKS: ReadonlyMap<number, number> = new Map(
  FORMATION_NAMES.map((name) => {
    const shape = FORMATIONS[name]
    return [bankKey(shape.DF, shape.MF, shape.FW), FORMATION_TEMPO[name]]
  }),
)

/**
 * The deepest requirement at each position across every formation.
 *
 * Derived rather than written out, so adding a formation cannot silently
 * invalidate it. Two subsystems depend on that: `canRelease` in `season.ts`, so a
 * club never releases its way out of a shape it might want, and `canSpare` in
 * `market.ts`, so it never sells its way out of one either. `canSpare` used to
 * assert its own floor by hand as `4-4-2 + 1` and claim that covered the rest —
 * true until 4-2-4 asked for a fourth forward, and false silently.
 */
export const DEEPEST_BANK: Readonly<Record<Position, number>> = Object.freeze(
  Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      Math.max(...Object.values(FORMATIONS).map((shape) => shape[position])),
    ]),
  ) as Record<Position, number>,
)

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

  // Bank counts are tallied in the same pass. They are what identifies the shape
  // for `FORMATION_TEMPO` below — see `bankKey`.
  let df = 0
  let mf = 0
  let fw = 0

  for (const player of outfield) {
    const attackShare = ATTACK_SHARE[player.position]
    const defenceShare = DEFENCE_SHARE[player.position]
    attackWeighted += attackShare * playerAttack(player)
    attackShares += attackShare
    defenceWeighted += defenceShare * playerDefence(player)
    defenceShares += defenceShare

    if (player.position === 'DF') df++
    else if (player.position === 'MF') mf++
    else fw++
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
    // than only your half of it. Zero at balanced *and* in 4-4-2, which is what
    // keeps the M2 calibration intact.
    //
    // Two contributors, added: the slider, and the shape. See `FORMATION_TEMPO`
    // for why a formation needs one at all.
    tempo: lever + (FORMATION_TEMPO_BY_BANKS.get(bankKey(df, mf, fw)) ?? 0),
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

/**
 * True when this squad can fill every bank the shape asks for.
 *
 * The question `pickXI` answers by throwing. A screen needs to ask it *before*
 * offering the button, and the reducer's own bookkeeping needs to ask it before
 * re-picking an XI for a club whose squad just changed underneath it.
 */
export function canField(squad: readonly Player[], formation: Formation): boolean {
  const shape = FORMATIONS[formation]
  return POSITIONS.every(
    (position) => squad.filter((p) => p.position === position).length >= shape[position],
  )
}

/**
 * The preferred shape if the squad can still field it, otherwise the default.
 *
 * A fallback rather than a throw, because both callers are AI bookkeeping inside
 * the reducer rather than a decision anybody made: a club that sold its fourth
 * striker simply stops playing 4-2-4. `errors.ts` is explicit that a `GameError`
 * is for a refusal the player is shown, and nobody is being refused here.
 *
 * `bestXI` still throws on the result. If 4-4-2 itself cannot be fielded the squad
 * is broken, and that is worth failing loudly over.
 */
export function fieldableFormation(squad: readonly Player[], preferred: Formation): Formation {
  return canField(squad, preferred) ? preferred : '4-4-2'
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
