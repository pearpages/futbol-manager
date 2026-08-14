/**
 * Geometry for the attribute radar.
 *
 * Geometry lives here; **colour lives in `styles/radar.css`** — the same split as
 * `badges.ts`. Nothing in this file knows what anything looks like, which is what
 * lets it be tested without a DOM.
 *
 * One axis per attribute, in `ATTRIBUTE_KEYS` order, starting at the top and
 * running clockwise. That order is not arbitrary and should not be "tidied": it
 * puts the attacking attributes (finishing, passing, dribbling) on the right half
 * and the defensive ones (tackling, heading, keeping) on the left, so a forward
 * and a centre-half lean visibly opposite ways.
 */

/** Drawn in a square box with room outside the rings for the eight labels. */
export const RADAR_VIEWBOX = '0 0 120 120'

const CENTRE = 60
const RADIUS = 40
const LABEL_RADIUS = 52

/** The grid octagons, as fractions of the full radius. */
export const RADAR_RINGS = [0.25, 0.5, 0.75, 1] as const

/** Values are 1–99, plotted against a round 100 so a 99 stops just short of the rim. */
const FULL_SCALE = 100

export interface Point {
  readonly x: number
  readonly y: number
}

/** −90° puts index 0 at the top; positive angles run clockwise in SVG's y-down space. */
function angle(index: number, count: number): number {
  return (-90 + (360 / count) * index) * (Math.PI / 180)
}

function at(radius: number, index: number, count: number): Point {
  const theta = angle(index, count)
  return { x: CENTRE + radius * Math.cos(theta), y: CENTRE + radius * Math.sin(theta) }
}

/** Rounded, because a `points` attribute of full doubles is unreadable in devtools. */
function join(points: readonly Point[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** One player's shape. Values are read in the order the axes are drawn. */
export function polygonPoints(values: readonly number[]): string {
  return join(values.map((value, i) => at((RADIUS * value) / FULL_SCALE, i, values.length)))
}

/** One grid octagon at a fraction of the full radius. */
export function ringPoints(fraction: number, count = 8): string {
  return join(Array.from({ length: count }, (_, i) => at(RADIUS * fraction, i, count)))
}

export interface Spoke {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

/** The lines from the centre out to each vertex of the outer ring. */
export function spokes(count = 8): readonly Spoke[] {
  return Array.from({ length: count }, (_, i) => {
    const outer = at(RADIUS, i, count)
    return { x1: CENTRE, y1: CENTRE, x2: round(outer.x), y2: round(outer.y) }
  })
}

export interface Label extends Point {
  /** Anchoring by half rather than by angle: text on the left must grow leftwards. */
  readonly anchor: 'start' | 'middle' | 'end'
}

export function labelAt(index: number, count = 8): Label {
  const { x, y } = at(LABEL_RADIUS, index, count)
  const dx = round(x) - CENTRE
  const anchor = Math.abs(dx) < 0.5 ? 'middle' : dx > 0 ? 'start' : 'end'
  return { x: round(x), y: round(y), anchor }
}

/** Where a vertex sits, for the dots on the subject's own polygon. */
export function nodeAt(value: number, index: number, count = 8): Point {
  const point = at((RADIUS * value) / FULL_SCALE, index, count)
  return { x: round(point.x), y: round(point.y) }
}
