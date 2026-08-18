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
  // Four the Spanish set has no use for and the clubs abroad do.
  'black-white',
  'claret-blue',
  'purple',
  'gold-black',
] as const

export type BadgeColours = (typeof COLOUR_KEYS)[number]

export interface Badge {
  readonly colours: BadgeColours
  readonly pattern: BadgePattern
  readonly shape: BadgeShape
}

/**
 * Keyed by club id, and covering every club in `@fm/data` — including the five in
 * the second tier, which have no fixtures but do have a crest wherever they are
 * listed.
 *
 * The five clubs on red-and-white stripes are deliberately given five different
 * shapes. **Blue-and-white is now the crowded one at four** — San Sebastián, Sarrià,
 * A Coruña and Málaga — which is what real kits do, and the shapes carry the whole
 * burden of telling them apart in a twenty-row table.
 */
export const BADGES: Readonly<Record<string, Badge>> = {
  madrid: { colours: 'white', pattern: 'solid', shape: 'circle' },
  barcelona: { colours: 'garnet-blue', pattern: 'stripes', shape: 'shield' },
  manzanares: { colours: 'red-white', pattern: 'stripes', shape: 'shield' },
  villarreal: { colours: 'yellow', pattern: 'solid', shape: 'shield' },
  'san-sebastian': { colours: 'blue-white', pattern: 'stripes', shape: 'shield' },
  bilbao: { colours: 'red-white', pattern: 'stripes', shape: 'circle' },
  heliopolis: { colours: 'green-white', pattern: 'stripes', shape: 'shield' },
  vigo: { colours: 'sky', pattern: 'solid', shape: 'lozenge' },
  sevilla: { colours: 'white-red', pattern: 'solid', shape: 'square' },
  valencia: { colours: 'orange-black', pattern: 'sash', shape: 'lozenge' },
  sarria: { colours: 'blue-white', pattern: 'hoops', shape: 'circle' },
  girona: { colours: 'red-white', pattern: 'stripes', shape: 'square' },
  getafe: { colours: 'blue', pattern: 'solid', shape: 'square' },
  benicalap: { colours: 'garnet-blue', pattern: 'stripes', shape: 'pennant' },
  'a-coruna': { colours: 'blue-white', pattern: 'stripes', shape: 'lozenge' },
  santander: { colours: 'green-white', pattern: 'stripes', shape: 'circle' },
  elche: { colours: 'white', pattern: 'solid', shape: 'lozenge' },
  vallecas: { colours: 'white-red', pattern: 'sash', shape: 'shield' },
  pamplona: { colours: 'red', pattern: 'solid', shape: 'pennant' },
  vitoria: { colours: 'white-blue', pattern: 'halves', shape: 'circle' },
  almeria: { colours: 'red-white', pattern: 'stripes', shape: 'lozenge' },
  palma: { colours: 'red-black', pattern: 'halves', shape: 'shield' },
  malaga: { colours: 'blue-white', pattern: 'stripes', shape: 'square' },
  cadiz: { colours: 'yellow', pattern: 'solid', shape: 'pennant' },
  granada: { colours: 'red-white', pattern: 'hoops', shape: 'shield' },

  // ── Abroad ────────────────────────────────────────────────────────────────
  // Kit colours again, and the same rule: a palette is shared, and what makes a
  // club distinguishable is the (colours, pattern, shape) triple. The test that
  // matters asserts no two of the fifty-seven repeat one.
  'en-islington': { colours: 'red-white', pattern: 'solid', shape: 'shield' },
  'en-manchester': { colours: 'sky', pattern: 'solid', shape: 'shield' },
  'en-fulham': { colours: 'blue', pattern: 'solid', shape: 'circle' },
  'en-trafford': { colours: 'red', pattern: 'solid', shape: 'shield' },
  'en-tottenham': { colours: 'white', pattern: 'solid', shape: 'square' },
  'en-newcastle': { colours: 'black-white', pattern: 'stripes', shape: 'shield' },

  'de-munchen': { colours: 'red', pattern: 'solid', shape: 'square' },
  'de-dortmund': { colours: 'yellow', pattern: 'solid', shape: 'circle' },
  'de-leipzig': { colours: 'red-white', pattern: 'solid', shape: 'circle' },
  'de-leverkusen': { colours: 'red-black', pattern: 'solid', shape: 'shield' },
  'de-frankfurt': { colours: 'black-white', pattern: 'solid', shape: 'square' },
  'de-stuttgart': { colours: 'white-red', pattern: 'stripes', shape: 'circle' },

  'fr-paris': { colours: 'blue', pattern: 'sash', shape: 'shield' },
  'fr-monaco': { colours: 'red-white', pattern: 'halves', shape: 'lozenge' },
  'fr-marseille': { colours: 'sky', pattern: 'solid', shape: 'square' },
  'fr-lyon': { colours: 'white-red', pattern: 'solid', shape: 'pennant' },
  'fr-lille': { colours: 'red-white', pattern: 'halves', shape: 'circle' },
  'fr-nice': { colours: 'red-black', pattern: 'stripes', shape: 'pennant' },

  'it-milano': { colours: 'blue', pattern: 'stripes', shape: 'pennant' },
  'it-torino': { colours: 'black-white', pattern: 'stripes', shape: 'lozenge' },
  'it-napoli': { colours: 'sky', pattern: 'solid', shape: 'pennant' },
  'it-navigli': { colours: 'red-black', pattern: 'stripes', shape: 'shield' },
  'it-roma': { colours: 'claret-blue', pattern: 'solid', shape: 'shield' },
  'it-bergamo': { colours: 'blue', pattern: 'stripes', shape: 'square' },

  'pt-lisboa': { colours: 'red', pattern: 'solid', shape: 'circle' },
  'pt-porto': { colours: 'blue-white', pattern: 'stripes', shape: 'pennant' },

  'nl-amsterdam': { colours: 'white-red', pattern: 'sash', shape: 'square' },
  'nl-eindhoven': { colours: 'red-white', pattern: 'sash', shape: 'circle' },

  'be-brugge': { colours: 'blue', pattern: 'hoops', shape: 'shield' },
  'be-anderlecht': { colours: 'purple', pattern: 'solid', shape: 'shield' },

  'tr-istanbul': { colours: 'gold-black', pattern: 'stripes', shape: 'circle' },
  'tr-kadikoy': { colours: 'yellow', pattern: 'halves', shape: 'shield' },
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
