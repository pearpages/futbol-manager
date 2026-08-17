/**
 * The four people on the hub, as pixel art.
 *
 * PC Fútbol's Menu Manager was illustrated — every quadrant a little vignette,
 * two of the four carrying human figures (suited agents in Mercado, a boardroom
 * in Finanzas). We took the *colour* of that screen at M5b and the *idea* of
 * per-tile icons, and left the artwork behind. This is the artwork.
 *
 * **Drawn here, from scratch.** ADR 0007 puts their icons and artwork squarely
 * on the protected side of the line, and `assets/README.md` is explicit that no
 * image in that folder becomes a sprite. Nothing here is traced and no colour is
 * eyedropped off a screenshot — these are generic figures in generic clothing,
 * which is not protectable subject matter. Same reasoning as `badges.ts`, said
 * again at the point of use because this is the file where someone would be
 * tempted to "just copy the pose".
 *
 * ## Why a text grid
 *
 * Geometry lives here; **colour lives in `styles/hub-figures.css`** — the split
 * `badges.ts` and `radar.ts` already use, and the reason this file has no hex
 * value in it. A pixel grid *is* geometry, so a sprite fits that model exactly:
 * one character per pixel, decoded into `<rect>`s grouped by ink role.
 *
 * Rects rather than a bitmap is not a stylistic call. They scale as vectors, so
 * the art is crisp at any size with no `image-rendering: pixelated` and no
 * half-pixel seams at non-integer scales — and it stays a diffable text block
 * that survives review. It also keeps this repo's rather nice property of having
 * no binary asset tracked anywhere: no image, no font, not even a favicon.
 *
 * ## Reading a grid
 *
 * Every figure is 28 × 32 on the same skeleton — head rows 2–9, torso 10–19,
 * legs 20–29, shoes 30–31 — so the four line up as a set when they sit along the
 * bottom of their panels. What separates them is silhouette, palette and one
 * prop each: the trainer's whistle sits on his chest, and the other three carry
 * something at the right hand, at three different heights and sizes.
 *
 * ## Case is the second axis: uppercase means "part of the prop"
 *
 * A character still names an ink, and **the case names the part** — `a` is an
 * accent pixel of the body, `A` the same accent inside the prop. That is what
 * lets the hub animate a clipboard without dragging a necktie along with it: the
 * agent and the director both draw a tie in `accent`, so the ink alone cannot
 * tell the two apart.
 *
 * Case rather than a bounding box, because a prop spans several inks — the
 * clipboard is `light` paper with `ink` rules and an `accent` clip — and a box
 * around it would have to carve the tie back out again. One character per pixel
 * also keeps a grid diffable, which a parallel mask would not.
 *
 * ## Two expressions, and only one of them showing
 *
 * `m` is the mouth at rest and `u` the smile the hub swaps in — see
 * `PART_BY_CHAR`. They are drawn **side by side rather than on top of each
 * other**, which is the property that keeps every guard in this file intact: no
 * pixel is claimed twice, the round trip stays exact, and paint order stays
 * free. It is also why every smile here has its corners on the mouth's own row
 * and its curve on the row below — the two shapes have to interlock rather than
 * overlap.
 */

import { gridSize, scanRuns } from './pixels.ts'

/**
 * An ink is a *role*, never a colour — `garment` rather than `green`. The value
 * is chosen per figure in CSS, which is what lets four people share one grid
 * vocabulary.
 *
 * Deliberately single words: the guard in `sprites.test.ts` checks that each one
 * has a matching `--sprite-<ink>` declaration, and a camelCase key would have
 * needed a translation table between the two halves of the split.
 */
export const INK_KEYS = [
  'hair',
  'skin',
  'shade',
  'ink',
  'garment',
  'seam',
  'trouser',
  'light',
  'accent',
] as const

export type InkKey = (typeof INK_KEYS)[number]

/**
 * The character each ink is drawn with, lowercase. Uppercase draws the same ink
 * as part of the prop; anything else in a grid is empty.
 */
export const INK_BY_CHAR: Readonly<Record<string, InkKey>> = {
  k: 'hair',
  s: 'skin',
  h: 'shade',
  i: 'ink',
  g: 'garment',
  d: 'seam',
  t: 'trouser',
  l: 'light',
  a: 'accent',
  m: 'ink',
  u: 'ink',
}

/**
 * The addressable pieces of a figure. `body` is the man; `prop` is the thing he
 * carries; `mouth` and `smile` are the two expressions, of which exactly one is
 * ever visible.
 *
 * Emitted in this order, so the prop paints last — the director's case handle
 * sits over his hand rather than under it. `mouth` and `smile` overlap nothing,
 * so their position in the order is free.
 */
export const PART_KEYS = ['body', 'mouth', 'smile', 'prop'] as const

export type PartKey = (typeof PART_KEYS)[number]

/**
 * Characters whose part is not the one their case implies.
 *
 * Case gave two parts and there are four, so the expressions carry their own
 * characters. Both draw in `ink` — which of them is *visible* is the expression,
 * and that is a CSS state rather than a colour. `u` is its own mnemonic.
 *
 * A stray `M` or `U` resolves to `prop` rather than to nothing, which sounds
 * dangerous and is not: the guard in `sprites.test.ts` puts every prop pixel at
 * column 18 or beyond, and a face is nowhere near it.
 */
export const PART_BY_CHAR: Readonly<Record<string, PartKey>> = {
  m: 'mouth',
  u: 'smile',
}

export type FigureKey = 'assistant' | 'trainer' | 'agent' | 'director'

/**
 * Seguiment's assistant: tracksuit top, results clipboard held at his side —
 * the tallest of the three props, and the only one with ruled lines on it.
 */
const ASSISTANT: readonly string[] = [
  '............................',
  '............................',
  '..........kkkkkkk...........',
  '.........kkkkkkkkk..........',
  '.........kkssssssk..........',
  '.........ksisssisk..........',
  '.........ksssssssk..........',
  '..........ssummus...........',
  '...........ssuus............',
  '............hhh.............',
  '.........ggglllggg..........',
  '.......gggggglgggggg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......ssgggggggggss........',
  '.........dddddddddss........',
  '.........ttttdtttt.AAAAA....',
  '.........ttttdttttLLLLLLL...',
  '.........ttttdttttLIIIIIL...',
  '.........ttttdttttLLLLLLL...',
  '.........tttt.ttttLIIIIIL...',
  '.........tttt.ttttLLLLLLL...',
  '.........tttt.ttttLIIIIIL...',
  '.........tttt.ttttLLLLLLL...',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........iiii.iiii..........',
  '........iiiii.iiiii.........',
]

/**
 * Entrenador's trainer: tracksuit, and a ball at his feet.
 *
 * **He had a whistle on a cord, twice, and it could not be made to work.** Drawn
 * as two strands converging on the whistle it was an unmistakable V-neck sweater;
 * redrawn as a single strand hanging straight down it became a necktie. At this
 * size *anything* on the centre of the chest is read as clothing, because that is
 * what is normally there. The ball is off the body entirely, sits on the same
 * ground line as his shoes, and is the only prop in the set that cannot be
 * mistaken for something he is wearing.
 */
const TRAINER: readonly string[] = [
  '............................',
  '............................',
  '..........kkkkkkk...........',
  '.........kkkkkkkkk..........',
  '.........ksssssssk..........',
  '.........ksisssisk..........',
  '.........ksssssssk..........',
  '..........ssummus...........',
  '...........ssuus............',
  '............hhh.............',
  '.........ggglllggg..........',
  '.......gggggglgggggg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......ssgggggggggss........',
  '.........ddddddddd..........',
  '.........ttttdtttt..........',
  '.........ttttdtttt..........',
  '.........ttttdtttt..........',
  '.........ttttdtttt..........',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........tttt.tttt..AAA.....',
  '.........tttt.tttt.AAAAA....',
  '.........tttt.tttt.AAIAA....',
  '.........iiii.iiii.AAAAA....',
  '........iiiii.iiiii.AAA.....',
]

/**
 * Mercat's agent: suit, tie, a contract held up at his side. The sheet is short
 * and carries a seal rather than ruled lines — the two pale props have to be
 * told apart at about four pixels to the pixel.
 */
const AGENT: readonly string[] = [
  '............................',
  '............................',
  '..........kkkkkkk...........',
  '.........kkkkkkkkk..........',
  '.........ksssssssk..........',
  '.........ksisssisk..........',
  '.........ksssssssk..........',
  '..........ssummus...........',
  '..........sssuuss...........',
  '............hhh.............',
  '.........ggglllggg..........',
  '.......gggggglgggggg........',
  '.......gdggglalgggdg........',
  '.......gdggglalgggdg........',
  '.......gdggggaggggdg........',
  '.......gdggggaggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......ssgggggggggss........',
  '.........dddddddddss........',
  '.........ttttdttttLLLLLL....',
  '.........ttttdttttLIIIIL....',
  '.........ttttdttttLLLLLL....',
  '.........ttttdttttLAALLL....',
  '.........tttt.ttttLLLLLL....',
  '.........tttt.ttttLLLLLL....',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........iiii.iiii..........',
  '........iiiii.iiiii.........',
]

/**
 * Finances' director: suit, tie, greying at the temples, briefcase at knee
 * height. His is the one dark, boxy prop against two pale flat ones, and the
 * lowest of the three — the pair of suits needed separating by more than palette.
 */
const DIRECTOR: readonly string[] = [
  '............................',
  '............................',
  '..........kkkkkkk...........',
  '.........lkkkkkkkl..........',
  '.........lsssssssl..........',
  '.........lsisssisl..........',
  '.........ksssssssk..........',
  '..........summmus...........',
  '..........ssuuuss...........',
  '............hhh.............',
  '........gggglllgggg.........',
  '.......gggggglgggggg........',
  '.......gdggglalgggdg........',
  '.......gdggglalgggdg........',
  '.......gdggggaggggdg........',
  '.......gdggggaggggdg........',
  '.......gdgggggggggdg........',
  '.......gdgggggggggdg........',
  '.......ssgggggggggss........',
  '.........dddddddddss........',
  '.........ttttdtttt.ss.......',
  '.........ttttdtttt..AA......',
  '.........ttttdttttAAAAAAA...',
  '.........ttttdttttAAAAAAA...',
  '.........tttt.ttttAAAIAAA...',
  '.........tttt.ttttAAAAAAA...',
  '.........tttt.ttttAAAAAAA...',
  '.........tttt.ttttAAAAAAA...',
  '.........tttt.tttt..........',
  '.........tttt.tttt..........',
  '.........iiii.iiii..........',
  '........iiiii.iiiii.........',
]

export const SPRITES: Readonly<Record<FigureKey, readonly string[]>> = {
  assistant: ASSISTANT,
  trainer: TRAINER,
  agent: AGENT,
  director: DIRECTOR,
}

export const FIGURE_KEYS = Object.keys(SPRITES) as readonly FigureKey[]

/** One run of identical pixels on a single row. Always one pixel tall. */
export interface SpriteRun {
  readonly x: number
  readonly y: number
  readonly w: number
}

/** Every run of one ink, within one part. */
export interface InkRuns {
  readonly ink: InkKey
  readonly runs: readonly SpriteRun[]
}

export interface SpritePart {
  readonly part: PartKey
  /** In `INK_KEYS` order, and only the inks this part actually uses. */
  readonly inks: readonly InkRuns[]
}

export interface DecodedSprite {
  readonly width: number
  readonly height: number
  /**
   * In `PART_KEYS` order, and only the parts a figure actually uses.
   *
   * Nested rather than a flat `(ink, part)` list so the hub can animate **one**
   * element per part. Several ink groups carrying the same animation would stay
   * in step in practice, but only by accident of them all starting together.
   */
  readonly parts: readonly SpritePart[]
}

/**
 * Collapse a grid into horizontal runs.
 *
 * Roughly 900 cells become about 120 rects, which is what keeps four figures on
 * the hub cheaper than one club badge on the market screen. Merging vertically
 * as well would cut it further and is deliberately not done: the round-trip test
 * is what makes the merge safe, and a rectangle-packing pass is a great deal
 * more code to prove correct for a screen that renders four of these.
 *
 * **Unknown characters are skipped rather than thrown on.** A typo in a grid
 * should render a hole a test catches, not white-screen the app on load — the
 * same call `badgeFor` makes when it falls back instead of throwing.
 *
 * Runs merge only across *identical* characters, so `a` and `A` never join —
 * which is exactly what keeps a prop separable from the body beside it.
 */
export function decodeSprite(rows: readonly string[]): DecodedSprite {
  const found = new Map<`${PartKey}/${InkKey}`, SpriteRun[]>()

  // The scan lives in `pixels.ts` — shared with the trophies, which group by ink
  // alone. Its merging is case-sensitive, which is what keeps a prop from
  // rejoining the body beside it; the grouping below is what needs both axes.
  for (const { char, x, y, w } of scanRuns(rows)) {
    const lower = char.toLowerCase()
    const ink = INK_BY_CHAR[lower]
    if (ink === undefined) continue

    const part: PartKey = PART_BY_CHAR[lower] ?? (char === lower ? 'body' : 'prop')
    const runs = found.get(`${part}/${ink}`)
    if (runs === undefined) found.set(`${part}/${ink}`, [{ x, y, w }])
    else runs.push({ x, y, w })
  }

  // Iterated in PART_KEYS × INK_KEYS order rather than insertion order, so the
  // emitted groups do not depend on which pixel a figure happens to draw first.
  const parts = PART_KEYS.flatMap<SpritePart>((part) => {
    const inks = INK_KEYS.flatMap<InkRuns>((ink) => {
      const runs = found.get(`${part}/${ink}`)
      return runs === undefined ? [] : [{ ink, runs }]
    })
    return inks.length === 0 ? [] : [{ part, inks }]
  })

  return { ...gridSize(rows), parts }
}

/**
 * Decoded once at module load rather than per render. The hub re-renders on
 * every tick of the day clock and the grids never change, so there is nothing to
 * recompute — the same reasoning as `BadgeDefs` hoisting its clip paths.
 */
export const FIGURES: Readonly<Record<FigureKey, DecodedSprite>> = {
  assistant: decodeSprite(ASSISTANT),
  trainer: decodeSprite(TRAINER),
  agent: decodeSprite(AGENT),
  director: decodeSprite(DIRECTOR),
}
