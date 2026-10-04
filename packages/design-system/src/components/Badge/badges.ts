/**
 * Badges: which colours, which shirt pattern, which shape.
 *
 * **These are not crests.** They are abstract shapes carrying a three-letter
 * code, painted in kit colours. Colours and simple geometric patterns — stripes,
 * halves, a sash — are not protectable subject matter, so the palette is free;
 * emblems and coats of arms are a different thing entirely and nothing here
 * should ever drift toward one. See docs/adr/0007-intellectual-property.md.
 *
 * Geometry lives here; **colour lives in `Badge.css`**, keyed on the `colours`
 * name rather than on a club. Which club wears which badge is the game's data,
 * and lives in the app (`screens/badges.ts`).
 */

export type BadgePattern = 'solid' | 'stripes' | 'halves' | 'sash' | 'hoops'
export type BadgeShape = 'shield' | 'circle' | 'square' | 'lozenge' | 'pennant'

/**
 * Every palette `Badge.css` defines a rule for.
 *
 * Exported so a test can assert the table only names schemes that exist — a
 * typo'd key would otherwise render an unstyled badge and look merely ugly
 * rather than broken.
 */
export const COLOUR_KEYS = [
  'white',
  'garnet-blue',
  // Barcelona's kit colours again, with a white code rather than a gold one —
  // the third token is the code colour, and it is the only thing separating this
  // from the palette above. See the block comment in `Badge.css`.
  'garnet-blue-white',
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
 * Patterns whose busy-ness would swallow three letters at row size, so the code
 * gets a solid nameplate band behind it. Real badges solve this the same way.
 */
export function needsNameplate(pattern: BadgePattern): boolean {
  return pattern === 'stripes' || pattern === 'hoops' || pattern === 'sash'
}
