/**
 * Club badges: which colours, which shirt pattern, which shape.
 *
 * **These are not crests.** They are abstract shapes carrying the three-letter
 * code each club already has, painted in kit colours. Colours and simple
 * geometric patterns — stripes, halves, a sash — are not protectable subject
 * matter, so the palette is free; emblems and coats of arms are a different
 * thing entirely and nothing here should ever drift toward one. See
 * docs/adr/0007-intellectual-property.md.
 *
 * **Shape is load-bearing, not decoration.** Following real kits puts red-and-
 * white stripes on five clubs, blue-and-white on two and yellow on two. Colour
 * alone cannot tell them apart in a twenty-row table, so the shape does — and a
 * test asserts no two clubs share a `(colours, pattern, shape)` triple.
 *
 * Geometry lives here; **colour lives in `styles/club-badges.css`**, keyed on the
 * `colours` name rather than the club. That split keeps every colour value in CSS
 * where the styling convention wants it, and keeps the twelve palettes from being
 * written out twenty times.
 */

export type BadgePattern = 'solid' | 'stripes' | 'halves' | 'sash' | 'hoops'
export type BadgeShape = 'shield' | 'circle' | 'square' | 'lozenge' | 'pennant'

/**
 * Every palette `club-badges.css` defines a rule for.
 *
 * Exported so a test can assert the table only names schemes that exist — a
 * typo'd key would otherwise render an unstyled badge and look merely ugly
 * rather than broken.
 */
export const COLOUR_KEYS = [
  'white',
  'garnet-blue',
  'red-white',
  'white-red',
  'blue-white',
  'orange-black',
  'yellow',
  'green-white',
  'sky',
  'red',
  'red-black',
  'blue',
  'white-blue',
] as const

export type BadgeColours = (typeof COLOUR_KEYS)[number]

export interface Badge {
  readonly colours: BadgeColours
  readonly pattern: BadgePattern
  readonly shape: BadgeShape
}

/**
 * Keyed by club id. The five clubs on red-and-white stripes are deliberately
 * given five different shapes; likewise the two on blue-and-white and the two on
 * yellow.
 */
export const BADGES: Readonly<Record<string, Badge>> = {
  madrid: { colours: 'white', pattern: 'solid', shape: 'circle' },
  barcelona: { colours: 'garnet-blue', pattern: 'stripes', shape: 'shield' },
  manzanares: { colours: 'red-white', pattern: 'stripes', shape: 'shield' },
  sevilla: { colours: 'white-red', pattern: 'solid', shape: 'square' },
  bilbao: { colours: 'red-white', pattern: 'stripes', shape: 'circle' },
  'san-sebastian': { colours: 'blue-white', pattern: 'stripes', shape: 'shield' },
  valencia: { colours: 'orange-black', pattern: 'sash', shape: 'lozenge' },
  villarreal: { colours: 'yellow', pattern: 'solid', shape: 'shield' },
  heliopolis: { colours: 'green-white', pattern: 'stripes', shape: 'shield' },
  vigo: { colours: 'sky', pattern: 'solid', shape: 'lozenge' },
  girona: { colours: 'red-white', pattern: 'stripes', shape: 'square' },
  pamplona: { colours: 'red', pattern: 'solid', shape: 'pennant' },
  palma: { colours: 'red-black', pattern: 'halves', shape: 'shield' },
  sarria: { colours: 'blue-white', pattern: 'hoops', shape: 'circle' },
  getafe: { colours: 'blue', pattern: 'solid', shape: 'square' },
  vitoria: { colours: 'white-blue', pattern: 'halves', shape: 'circle' },
  vallecas: { colours: 'white-red', pattern: 'sash', shape: 'shield' },
  cadiz: { colours: 'yellow', pattern: 'solid', shape: 'pennant' },
  granada: { colours: 'red-white', pattern: 'hoops', shape: 'shield' },
  almeria: { colours: 'red-white', pattern: 'stripes', shape: 'lozenge' },
}

/** Falls back rather than throwing: a missing badge should not blank a screen. */
export function badgeFor(clubId: string): Badge {
  return BADGES[clubId] ?? { colours: 'white', pattern: 'solid', shape: 'shield' }
}

/**
 * Patterns whose busy-ness would swallow three letters at row size, so the code
 * gets a solid nameplate band behind it. Real badges solve this the same way.
 */
export function needsNameplate(pattern: BadgePattern): boolean {
  return pattern === 'stripes' || pattern === 'hoops' || pattern === 'sash'
}
