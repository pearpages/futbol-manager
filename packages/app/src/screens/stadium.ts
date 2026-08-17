import { gridSize, type PixelRun, scanRuns } from './pixels.ts'

/**
 * The ground, as pixel art, drawn two ways and built a module at a time.
 *
 * Capacity was a number and nothing else, and the ground is the only thing in
 * the game the manager *builds* — `StartExpansion` buys 1,000 to 15,000 seats,
 * the money leaves at once and the seats arrive at the rollover. A bigger
 * drawing is what turns an accounting line into something you can see you
 * bought.
 *
 * Same idiom as `sprites.ts` and `trophies.ts`: **geometry as text grids, colour
 * in `styles/stadium.css`**, not one hex value in any of these files. The scan
 * is shared; see `pixels.ts`.
 *
 * ## Modules, not twelve whole pictures
 *
 * The first version of this held one complete grid per tier. That cannot show
 * what you have *not* built, and showing it is the point — a ground you can keep
 * extending should say so. So the drawing is a list of modules, each holding
 * only the ring or the structure it adds. `StadiumView` paints the ones the club
 * has earned solid and the rest faded, fainter the further off they are, so the
 * whole ambition is on screen at once and the next step is the clearest ghost.
 *
 * **Modules are disjoint** — no cell is drawn by two of them. That is what makes
 * paint order free and, more importantly, what stops a ghost painting over
 * something already built. It is a test.
 *
 * Two views, because neither is enough alone. The **plan** says how far the
 * ground spreads; the **section** says how high it stands. Above about tier 7 a
 * plan view stops being able to tell you much — one more ring around an
 * unchanged pitch — while the section shows decks stacking clearly all the way
 * to the top of the ladder.
 *
 * ## The ladder
 *
 * Eleven thresholds, twelve tiers, topping out past 200,000. The first six are
 * the ones the seven-tier version shipped with, so the twenty clubs in the
 * league land exactly where they already did (2/4/3/4/3/2/2 across tiers 1-7);
 * tiers 8-12 are the ghost future nobody starts in.
 *
 * The steps are not evenly spaced because grounds are not: the league runs
 * 14,708 to 105,000 with the bulk between 20,000 and 35,000, so even steps would
 * put most of the division in one bucket.
 *
 * **There is no cap on capacity in the domain** — `MIN_EXPANSION`/`MAX_EXPANSION`
 * bound a single job, not the ground — so tier 12 is open-ended and
 * `stadiumTierFor` clamps at both ends rather than throwing, the way `badgeFor`
 * does. At one max-size job a year, 200,000 is seven seasons from Barcelona and
 * thirteen from Vallecas.
 */

/**
 * An ink is a role, never a colour. Single words, because `stadium.test.ts`
 * checks each has a matching `--stadium-<ink>` declaration and a fill rule.
 */
export const STADIUM_INK_KEYS = [
  'roof',
  'walk',
  'lit',
  'mid',
  'shade',
  'seam',
  'apron',
  'turf',
  'stripe',
  'line',
] as const

export type StadiumInk = (typeof STADIUM_INK_KEYS)[number]

/**
 * The character each ink is drawn with. Anything else in a grid is empty.
 *
 * `lit`, `mid` and `shade` are the same seating under different light: the far
 * side of the bowl catches it and the near side falls into shadow, which is what
 * turns a flat ring into something you are looking down into. `seam` is both the
 * gangway between two decks and the step line every fourth row — one dark ink
 * doing both, because a gangway and a row of steps are the same thing at two
 * scales.
 */
export const STADIUM_INK_BY_CHAR: Readonly<Record<string, StadiumInk>> = {
  r: 'roof',
  c: 'walk',
  l: 'lit',
  n: 'mid',
  h: 'shade',
  k: 'seam',
  a: 'apron',
  g: 'turf',
  s: 'stripe',
  w: 'line',
}

/** How full a ground has to be to earn each module. The last is open-ended. */
export const STADIUM_TIERS = [
  18_000, 24_000, 32_000, 42_000, 55_000, 75_000, 105_000, 130_000, 155_000, 180_000, 200_000,
] as const

export type StadiumTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** The highest tier there is. Derived, so adding a threshold moves it. */
export const TOP_TIER = (STADIUM_TIERS.length + 1) as StadiumTier

/**
 * Which tier a capacity has earned.
 *
 * Clamps rather than throws at both ends — a career can build past anything the
 * league ships, and a ground below the floor should still get the smallest
 * drawing rather than bring the screen down.
 */
export function stadiumTierFor(capacity: number): StadiumTier {
  if (!Number.isFinite(capacity)) return 1
  const earned = STADIUM_TIERS.filter((threshold) => capacity > threshold).length
  return (earned + 1) as StadiumTier
}

/**
 * How faint an unbuilt module is drawn, bucketed rather than a raw distance.
 *
 * Four steps, not eleven. Eleven opacities are not distinguishable from one
 * another, and "fading with distance" only needs enough to say *next*, *soon*
 * and *someday*. `null` for something already built is what the view keys on, so
 * a built module carries no ghost attribute at all.
 *
 * A bucketed attribute, never a JSX `style` prop — the styling convention has no
 * exception for data-driven values, and `.attr__fill[data-fill='0..20']` is the
 * precedent for a handful of small rules.
 */
export type GhostDepth = 'next' | 'soon' | 'far' | 'distant'

export function ghostDepth(moduleTier: number, current: StadiumTier): GhostDepth | null {
  const ahead = moduleTier - current
  if (ahead <= 0) return null
  if (ahead === 1) return 'next'
  if (ahead <= 3) return 'soon'
  if (ahead <= 6) return 'far'
  return 'distant'
}

/** One thing you can build, and the tier that earns it. */
export interface StadiumModule {
  readonly key: string
  readonly tier: StadiumTier
  readonly grid: readonly string[]
}

/** Every run of one ink. */
export interface StadiumInkRuns {
  readonly ink: StadiumInk
  readonly runs: readonly Omit<PixelRun, 'char'>[]
}

export interface DecodedStadium {
  readonly width: number
  readonly height: number
  /** In `STADIUM_INK_KEYS` order, and only the inks the grid actually uses. */
  readonly inks: readonly StadiumInkRuns[]
}

/** A module with its geometry worked out. */
export interface DecodedModule extends DecodedStadium {
  readonly key: string
  readonly tier: StadiumTier
}

/**
 * Groups a grid's runs by ink.
 *
 * Flat, like `decodeTrophy` and unlike `decodeSprite` — a ground has no parts to
 * animate, so the part axis that file needs would be one group wrapped around
 * everything.
 */
export function decodeStadium(rows: readonly string[]): DecodedStadium {
  const found = new Map<StadiumInk, Omit<PixelRun, 'char'>[]>()

  for (const { char, x, y, w } of scanRuns(rows)) {
    const ink = STADIUM_INK_BY_CHAR[char]
    if (ink === undefined) continue
    const runs = found.get(ink)
    if (runs === undefined) found.set(ink, [{ x, y, w }])
    else runs.push({ x, y, w })
  }

  // Iterated in `STADIUM_INK_KEYS` order rather than insertion order, so the
  // emitted groups do not depend on which pixel the grid happens to draw first.
  const inks = STADIUM_INK_KEYS.flatMap<StadiumInkRuns>((ink) => {
    const runs = found.get(ink)
    return runs === undefined ? [] : [{ ink, runs }]
  })

  return { ...gridSize(rows), inks }
}

/** Decoded once at module load — the same reasoning as `FIGURES` and `TROPHIES`. */
export function decodeAll(modules: readonly StadiumModule[]): readonly DecodedModule[] {
  return modules.map((m) => ({ key: m.key, tier: m.tier, ...decodeStadium(m.grid) }))
}
