import { gridSize, type PixelRun, scanRuns } from './pixels.ts'

/**
 * The silverware, as pixel art.
 *
 * A palmarés that lists years is a spreadsheet. The trophy is what makes winning
 * the league look like winning something, and it is the same idiom the hub figures
 * already established: **geometry as a text grid here, colour in
 * `styles/trophies.css`**, not one hex value in this file.
 *
 * ## A generic cup, and this is a deliberate line rather than a shortcut
 *
 * **This is not a drawing of the actual competition trophy.** ADR 0007 puts icons,
 * artwork and emblems squarely on the protected side, and a competition's trophy is
 * its emblem every bit as much as a club's crest is — which is the whole reason
 * `badges.ts` draws abstract shapes rather than coats of arms. What is drawn here
 * is a footed two-handled cup on a plinth: the shape trophies have had since
 * antiquity, carrying nothing anybody owns. Said out loud at the point of use,
 * because this is the file where someone would be tempted to match a photograph.
 *
 * ## Inks are roles, and the shading is derived
 *
 * `metal`, `plinth` and `ink`. `sheen` and `shade` are **`color-mix`ed from
 * `metal` in the stylesheet rather than declared**, so a trophy names two colours
 * and no more. That is the lesson the badge rim and the sprite shading both paid
 * for: hand-picked neighbours look fine and are wrong, and the fix is deriving
 * them from a colour that is already right.
 *
 * ## Why 16 × 20, and why it is never small
 *
 * A hub figure is `8rem` over 32 rows — **four device pixels per grid row**, which
 * is what makes it read as pixel art rather than as a smudge. A 16 × 20 cup at
 * `5rem` gets the same four. Rendered inline in a table row at a badge's
 * `1.25rem` it would get *one*, at which the handles, the sheen and the stem all
 * vanish. So a trophy appears once per competition in the honours panel and never
 * inside a results or history row — see `trophies.css`, which has no small variant
 * to reach for.
 *
 * ## Adding the cup and the supercup
 *
 * Additive, and cheap: a grid here, a five-line palette block in the stylesheet,
 * and one dictionary key per language. They are **not** pre-declared — ground rule
 * 5, and concretely because `trophies.test.ts` asserts every declared key is
 * actually rendered, so a placeholder would need either a fake grid or a loosened
 * guard.
 *
 * They should get their own *silhouettes* rather than a recolour of this one. A
 * footed cup, a lidded cup and a shallow dish tell three trophies apart at a
 * glance; the same shape in three metals does not, which is exactly the mistake
 * five clubs on red-and-white forced `badges.ts` to avoid.
 */

/**
 * An ink is a role, never a colour. Single words, because `trophies.test.ts`
 * checks each one has a matching `--trophy-<ink>` declaration.
 */
export const TROPHY_INK_KEYS = ['metal', 'sheen', 'shade', 'plinth', 'ink'] as const

export type TrophyInk = (typeof TROPHY_INK_KEYS)[number]

/** The character each ink is drawn with. Anything else in a grid is empty. */
export const TROPHY_INK_BY_CHAR: Readonly<Record<string, TrophyInk>> = {
  m: 'metal',
  l: 'sheen',
  h: 'shade',
  p: 'plinth',
  i: 'ink',
}

/**
 * The competitions with a trophy. One today; see the note above on adding more.
 */
export const TROPHY_KEYS = ['league'] as const

export type TrophyKey = (typeof TROPHY_KEYS)[number]

/**
 * The league trophy: a footed two-handled cup on a plinth.
 *
 * Rows 1–2 are the rim, 3–7 the bowl, 8–9 its taper, 10–12 the stem, 13–14 the
 * flared foot, 15–17 the plinth and 18 its shadow line.
 *
 * **The handles are the whole difficulty, and they are attached at both ends on
 * purpose.** They meet the flared lip at row 3 and rejoin the bowl at row 7, with
 * one pixel of daylight through the middle at rows 4–6 — so the eye reads a closed
 * loop. Four earlier attempts are worth not repeating: a handle attached only at
 * the rim reads as a wing, its free tip drifting away from a tapering bowl; a
 * one-pixel-thick handle disappears; and a bowl that narrows too fast turns the
 * whole thing into a rocket. That daylight is what a test asserts, because filling
 * it is silent — a solid block still looks like *something*.
 *
 * The grid is 16 wide rather than 12 for exactly that reason: two 2-pixel handles
 * plus a gap either side is 6 columns before the bowl gets any.
 *
 * `l` down the left and `h` down the right is one light source, applied to the
 * bowl, the handles and the stem alike, which is what stops flat gold reading as a
 * paper cut-out. There is no outline — an `ink` border would eat a quarter of a
 * 16-wide bowl, so the silhouette works against the dark `.screen` on its own and
 * `ink` is spent only on the plinth's shadow.
 */
const LEAGUE: readonly string[] = [
  '................',
  '..llllllllllll..',
  '..lmmmmmmmmmmh..',
  '.lmmmmmmmmmmmmh.',
  'lm.lmmmmmmmmh.mh',
  'lm.lmmmmmmmmh.mh',
  'lm.lmmmmmmmmh.mh',
  '.lmmmmmmmmmmmmh.',
  '...lmmmmmmmmh...',
  '.....lmmmmh.....',
  '.......lh.......',
  '.......lh.......',
  '.......lh.......',
  '.....lmmmmh.....',
  '...lmmmmmmmmh...',
  '..pppppppppppp..',
  '..pppppppppppp..',
  '.pppppppppppppp.',
  '..iiiiiiiiiiii..',
  '................',
]

/** Every run of one ink. */
export interface TrophyInkRuns {
  readonly ink: TrophyInk
  readonly runs: readonly Omit<PixelRun, 'char'>[]
}

export interface DecodedTrophy {
  readonly width: number
  readonly height: number
  /** In `TROPHY_INK_KEYS` order, and only the inks the grid actually uses. */
  readonly inks: readonly TrophyInkRuns[]
}

/**
 * Groups a grid's runs by ink.
 *
 * Flat, unlike `decodeSprite` — a trophy has no parts to animate, no prop to hold
 * clear of a necktie and no second expression, so the part axis that file needs
 * would be one group called `body` wrapped around everything. The scan itself is
 * shared; see `pixels.ts`.
 */
export function decodeTrophy(rows: readonly string[]): DecodedTrophy {
  const found = new Map<TrophyInk, Omit<PixelRun, 'char'>[]>()

  for (const { char, x, y, w } of scanRuns(rows)) {
    const ink = TROPHY_INK_BY_CHAR[char]
    if (ink === undefined) continue
    const runs = found.get(ink)
    if (runs === undefined) found.set(ink, [{ x, y, w }])
    else runs.push({ x, y, w })
  }

  // Iterated in `TROPHY_INK_KEYS` order rather than insertion order, so the
  // emitted groups do not depend on which pixel the grid happens to draw first.
  const inks = TROPHY_INK_KEYS.flatMap<TrophyInkRuns>((ink) => {
    const runs = found.get(ink)
    return runs === undefined ? [] : [{ ink, runs }]
  })

  return { ...gridSize(rows), inks }
}

/** The raw grids, exported so a test can count pixels against the emitted rects. */
export const TROPHY_GRIDS: Readonly<Record<TrophyKey, readonly string[]>> = {
  league: LEAGUE,
}

/**
 * Decoded once at module load. The grids never change and the palmarés re-renders
 * with the rest of the screen — the same reasoning as `FIGURES` and `BadgeDefs`.
 */
export const TROPHIES: Readonly<Record<TrophyKey, DecodedTrophy>> = {
  league: decodeTrophy(LEAGUE),
}
