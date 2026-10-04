/** The four positions a slot can hold. The game's own `Position` is the same union. */
export type Position = 'GK' | 'DF' | 'MF' | 'FW'

/**
 * Geometry for the lineup pitch.
 *
 * Geometry lives here; **colour lives in `styles/pitch.css`** — the same split as
 * `badges.ts` and `radar.ts`. Nothing in this file knows what anything looks
 * like, which is what lets it be tested without a DOM.
 *
 * **Nothing here is state.** Every coordinate is recomputed each render from the
 * order of `lineup.starters` and each player's `position`, so the pitch adds no
 * field to `Lineup` and no migration. The one change that *would* need a schema
 * bump is storing a slot per player — a genuinely different feature (it would let
 * you field a left-back on the right), and it must be argued on its own.
 */

/** Portrait, attacking upward — your own goal is at the bottom. */
const WIDTH = 100
const HEIGHT = 150
export const PITCH_VIEWBOX = `0 0 ${WIDTH} ${HEIGHT}`

const CENTRE_X = WIDTH / 2

/** The disc a player is drawn as. Half of it is the crowding budget below. */
export const SLOT_RADIUS = 7.5

/**
 * One fixed depth per position, and deliberately *not* derived from the bank
 * counts.
 *
 * A formation here is only its bank counts — `lineup.ts` is explicit that
 * 4-2-3-1 and 4-5-1 are the same shape to this model. So sliding the midfield
 * deeper in 4-2-4, or pushing the back three up in 3-4-3, would draw a
 * distinction the model does not make: the pitch would be claiming to know
 * something the resolver never sees. Four bands always exist, because across all
 * eight shapes DF >= 3, MF >= 2 and FW >= 1.
 */
const BAND_Y: Readonly<Record<Position, number>> = { GK: 134, DF: 106, MF: 74, FW: 38 }

/**
 * How wide one player's lane is before a bank has to start crowding, and the
 * widest a bank may ever spread.
 *
 * Spreading every bank across the full width is the obvious formula and it is
 * wrong: two strikers end up on the touchlines, which reads as a tactic rather
 * than as two strikers. Giving each man a fixed lane and only clamping once the
 * bank outgrows the pitch puts two at 39/61 and five at 16.4…83.6, and the
 * tightest case in the game — five across — still leaves 16.8 units of spacing
 * against a 15-unit disc. That 1.8 units of daylight is what `pitch.test.ts`
 * pins; drop `SLOT_SPAN` and the five-man banks touch.
 */
const USABLE = 84
const SLOT_SPAN = 22

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Where the `index`-th of `count` players in one bank stands, across the pitch. */
export function laneX(index: number, count: number): number {
  if (count <= 0) return CENTRE_X
  const span = Math.min(USABLE, count * SLOT_SPAN)
  return round(CENTRE_X + span * ((index + 0.5) / count - 0.5))
}

export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * One point per player, **in the order given**.
 *
 * Order is the caller's, and that is load-bearing. `LineupScreen`'s `swap` is an
 * in-place replacement inside `lineup.starters`, so indexing a bank by encounter
 * order means a substitution lands the new man in exactly the slot the old one
 * vacated and moves nobody else. Sorting by `overall` instead would slide a whole
 * back four sideways every time a weaker full-back came on — plausible-looking,
 * and wrong in the way a manager notices immediately.
 *
 * The shape is read off the players, never off `lineup.formation`: the reducer
 * validates that an XI is *legal* but never that it matches its own declared
 * label, which is the same reason `teamRatingRaw` derives the shape rather than
 * trusting it. Deriving means the pitch cannot draw a lie.
 */
export function pitchSlots(positions: readonly Position[]): readonly Point[] {
  const counts: Record<string, number> = {}
  for (const position of positions) counts[position] = (counts[position] ?? 0) + 1

  const seen: Record<string, number> = {}
  return positions.map((position) => {
    const index = seen[position] ?? 0
    seen[position] = index + 1
    return { x: laneX(index, counts[position] ?? 1), y: BAND_Y[position] }
  })
}

/**
 * The markings, as plain numbers so the component holds none of its own — the
 * same reason `radar.ts` exports its rings and spokes rather than letting the
 * chart draw them.
 */
export const PITCH_MARKINGS = {
  /** The touchlines, inset so the stroke is not clipped by the viewport. */
  outline: { x: 2, y: 2, width: WIDTH - 4, height: HEIGHT - 4 },
  halfway: { y: HEIGHT / 2 },
  centre: { x: CENTRE_X, y: HEIGHT / 2, r: 14 },
  /** Penalty areas, ours at the foot. */
  boxes: [
    { x: 21, y: 2, width: 58, height: 28 },
    { x: 21, y: HEIGHT - 30, width: 58, height: 28 },
  ],
  sixYard: [
    { x: 37, y: 2, width: 26, height: 11 },
    { x: 37, y: HEIGHT - 13, width: 26, height: 11 },
  ],
} as const
