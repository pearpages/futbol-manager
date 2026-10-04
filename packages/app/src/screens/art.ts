/**
 * The game's painted art, by key. Each key is also the filename under
 * `public/art`, which `art.test.ts` checks. The components that show them —
 * `HubFigure`, `TrophyIcon` — are the design system's and take a `src`.
 */

/** The four people, one per hub quadrant. */
export const FIGURE_KEYS = ['assistant', 'trainer', 'agent', 'director'] as const

export type FigureKey = (typeof FIGURE_KEYS)[number]

/** One competition so far. */
export const TROPHY_KEYS = ['league'] as const

export type TrophyKey = (typeof TROPHY_KEYS)[number]

/** Where a figure or trophy is served from. */
export const artSrc = (key: FigureKey | TrophyKey): string => `/art/${key}.webp`
