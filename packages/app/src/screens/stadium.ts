import { hashSeed } from '@fm/domain'

/**
 * Which drawing a ground of a given size gets.
 *
 * **The file is named for the seats it looks like**, so `35k.webp` is a picture of
 * a thirty-five-thousand-seat ground and a club draws whichever name is *closest*
 * to what it actually has. That replaces a ladder of index-named files
 * (`01.webp`..`30.webp`) paired with a table of thresholds — two things that had to
 * be kept in step and said nothing on their own.
 *
 * **Nearest, not a floor.** A 14,708-seat ground draws `15k`; a floor would give it
 * `14k` and leave every drawing overstating by up to a rung. Ties break to the
 * *smaller* drawing, so the picture never claims more than the club has.
 *
 * **Purely cosmetic.** Nothing reads this but the drawing: `stadiumArtFor`'s only
 * non-test caller is `EstadioScreen`. No finance, no domain, no save format — so
 * the ladder can be retuned freely, and a change here can never move a band.
 */

/**
 * Every drawing on disk, ordered by seats. `variants` counts the *extra* lettered
 * siblings — 0 means `24k.webp` alone, 1 means `24k.webp` and `24ka.webp`.
 *
 * The rungs are dense at the bottom and sparse at the top because that is where the
 * art is: the league runs 14,624 to 105,000, so a thousand seats is a visible
 * difference down there and is nothing at 150k. Spacing follows the drawings rather
 * than a grid — the pictures were sorted by apparent size first and named after.
 *
 * A letter means two drawings were judged interchangeable, not that they are two
 * sizes. Everything else is architecturally distinct enough to hold its own number.
 */
export const STADIUM_ART = [
  { seats: 6_000, variants: 0 },
  { seats: 10_000, variants: 0 },
  { seats: 11_000, variants: 0 },
  { seats: 12_000, variants: 0 },
  { seats: 13_000, variants: 0 },
  { seats: 14_000, variants: 0 },
  { seats: 15_000, variants: 0 },
  { seats: 16_000, variants: 0 },
  { seats: 17_000, variants: 0 },
  { seats: 18_000, variants: 0 },
  { seats: 19_000, variants: 0 },
  { seats: 20_000, variants: 0 },
  { seats: 22_000, variants: 0 },
  { seats: 23_000, variants: 0 },
  { seats: 24_000, variants: 1 },
  { seats: 25_000, variants: 1 },
  { seats: 26_000, variants: 0 },
  { seats: 27_000, variants: 0 },
  { seats: 28_000, variants: 0 },
  { seats: 29_000, variants: 0 },
  { seats: 30_000, variants: 0 },
  { seats: 31_000, variants: 0 },
  { seats: 32_000, variants: 0 },
  { seats: 33_000, variants: 0 },
  { seats: 34_000, variants: 0 },
  { seats: 35_000, variants: 0 },
  { seats: 36_000, variants: 0 },
  { seats: 37_000, variants: 0 },
  { seats: 38_000, variants: 0 },
  { seats: 39_000, variants: 0 },
  { seats: 40_000, variants: 0 },
  { seats: 41_000, variants: 0 },
  { seats: 42_000, variants: 0 },
  { seats: 44_000, variants: 0 },
  { seats: 45_000, variants: 0 },
  { seats: 46_000, variants: 0 },
  { seats: 48_000, variants: 0 },
  { seats: 50_000, variants: 0 },
  { seats: 53_000, variants: 0 },
  { seats: 55_000, variants: 0 },
  { seats: 62_000, variants: 0 },
  { seats: 65_000, variants: 0 },
  { seats: 70_000, variants: 0 },
  { seats: 75_000, variants: 0 },
  { seats: 80_000, variants: 0 },
  { seats: 85_000, variants: 0 },
  { seats: 90_000, variants: 0 },
  { seats: 95_000, variants: 0 },
  { seats: 100_000, variants: 0 },
  { seats: 110_000, variants: 0 },
  { seats: 130_000, variants: 0 },
  { seats: 150_000, variants: 0 },
  { seats: 170_000, variants: 0 },
  { seats: 200_000, variants: 0 },
] as const

/** A chosen drawing: the rung it came from, and the file to load. */
export type StadiumArt = {
  /** The rung's seats, e.g. `24_000`. Drives the render scale. */
  readonly seats: number
  /** Base name without extension, e.g. `24k` or `24ka`. */
  readonly file: string
}

/** `24_000` -> `24k`. The key the scale in `stadium.css` is written against. */
export function seatsKey(seats: number): string {
  return `${String(seats / 1000)}k`
}

/**
 * The drawing closest to what this club has built.
 *
 * Clamps at both ends rather than throwing: a career can build past anything
 * shipped, and a ground below the smallest drawing must still render rather than
 * bring the screen down.
 *
 * **The variant is chosen from the club id, never drawn.** Something has to pick
 * between `24k` and `24ka`, and eight of the twenty-five clubs sit between 21k and
 * 25k — so without this they would all draw the same picture. Deterministic, so it
 * holds still across re-renders, navigation and a save/reload, and nothing has to be
 * stored. Same reasoning as `marketSeed` in `MarketScreen.tsx`.
 */
export function stadiumArtFor(capacity: number, clubId: string): StadiumArt {
  const rung = nearestRung(capacity)
  // `hashSeed` returns a *signed* 32-bit int, so this needs the abs — a negative
  // modulo indexes off the front of the alphabet and yields an undefined suffix.
  const pick = rung.variants === 0 ? 0 : Math.abs(hashSeed(clubId)) % (rung.variants + 1)
  const suffix = pick === 0 ? '' : String.fromCharCode(96 + pick)
  return { seats: rung.seats, file: `${seatsKey(rung.seats)}${suffix}` }
}

type Rung = (typeof STADIUM_ART)[number]

function nearestRung(capacity: number): Rung {
  // Annotated, not inferred: `STADIUM_ART` is `as const`, so indexing element zero
  // narrows to *that rung's* literal type and nothing else can be assigned to it.
  const first: Rung | undefined = STADIUM_ART[0]
  /* c8 ignore next */
  if (first === undefined) throw new Error('no stadium art')
  if (!Number.isFinite(capacity)) return first

  let best: Rung = first
  for (const rung of STADIUM_ART) {
    // Strictly closer, so an exact tie keeps the earlier — the smaller — rung.
    if (Math.abs(rung.seats - capacity) < Math.abs(best.seats - capacity)) best = rung
  }
  return best
}
