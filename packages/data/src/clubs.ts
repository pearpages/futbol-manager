import { type Club, type ClubId, EMPTY_LEDGER, FINANCE, seedCapacity } from '@fm/domain'

/**
 * The default league — twenty clubs named after their cities.
 *
 * **A club is its city.** Where a city fields more than one club in the division,
 * the second takes the name of the district or ground it is identified with —
 * Manzanares, Heliópolis, Sarrià, Vallecas. A supporter places those instantly,
 * and they read as club names in a table, which crowd nicknames
 * ("Colchoneros", "Periquitos") do not.
 *
 * This is the convention unlicensed football games have always used: a city name
 * is not a club trademark. Real club names stay a user-supplied import.
 *
 * Content lives in `data`, never in `domain`.
 *
 * **Ordering is canonical and load-bearing** — ids seed fixture generation, so
 * reordering this list or renaming an id changes every generated season for a
 * given seed.
 */

/**
 * `[id, name, shortName, attack, defence]`.
 *
 * Ratings are **provisional and M2-only** — they stand in for squads until players
 * exist at M3, where the rating is derived from the selected XI instead. They were
 * calibrated with the harness; see docs/roadmap.md M2.
 *
 * The shape of the spread is what makes a league feel like a league. Real top
 * divisions are top-heavy rather than evenly graded: two or three clubs clear of
 * the rest, a broad middle where a few rating points separate seventh from
 * fourteenth, and a weak tail. A uniform ramp from 40 to 90 produces a tidy,
 * lifeless table.
 */
const CLUBS: readonly (readonly [string, string, string, number, number])[] = [
  // Contenders
  ['madrid', 'Madrid', 'MAD', 88, 85],
  ['barcelona', 'Barcelona', 'BAR', 86, 82],
  ['manzanares', 'Manzanares', 'MZN', 80, 86], // Madrid's second club
  // European places
  ['sevilla', 'Sevilla', 'SEV', 76, 74],
  ['bilbao', 'Bilbao', 'BIL', 73, 72],
  ['san-sebastian', 'San Sebastián', 'SSB', 70, 74],
  // The broad middle — a few points apart, so finishing order here is mostly form
  ['valencia', 'Valencia', 'VAL', 68, 66],
  ['villarreal', 'Villarreal', 'VLL', 67, 64],
  ['heliopolis', 'Heliópolis', 'HEL', 66, 67], // Sevilla's second club
  ['vigo', 'Vigo', 'VIG', 65, 65],
  ['girona', 'Girona', 'GIR', 65, 61],
  ['pamplona', 'Pamplona', 'PAM', 64, 66],
  ['palma', 'Palma', 'PAL', 63, 64],
  ['sarria', 'Sarrià', 'SAR', 61, 63], // Barcelona's second club
  // Strugglers
  ['getafe', 'Getafe', 'GET', 59, 60],
  ['vitoria', 'Vitoria', 'VIT', 58, 58],
  ['vallecas', 'Vallecas', 'VAS', 57, 56], // Madrid's third club
  // The tail
  ['cadiz', 'Cádiz', 'CAD', 54, 53],
  ['granada', 'Granada', 'GRA', 52, 51],
  ['almeria', 'Almería', 'ALM', 49, 50],
]

/**
 * Transfer budgets, in thousands, seeded from the club's rating.
 *
 * Steeply convex on purpose. If Almería could outspend Madrid the table would
 * invert within a few seasons, so the money has to reflect the pecking order it
 * came from — real budgets are far more unequal than real squads.
 *
 * **The base was 400 until M4b, and it made the market decorative.** A club rated
 * 62 held 946k while a player of its own first-team standard asked ~3,300k, so
 * across the whole league there was not one affordable signing that would improve
 * anybody's XI — measured, not guessed: 48 of 228 listed players were affordable
 * to a mid-table club and every one of them scored zero on need. The AI still
 * traded, because it only ever bought the cheap marginal players its
 * value-for-money filter allows, which is why nothing looked wrong from outside.
 *
 * The base is now set so a budget buys roughly **two players of the club's own
 * first-team standard** — enough to fix a weakness rather than shuffle a bench.
 * Only the scale changed; the exponent is untouched, so every club's share of the
 * league's money is exactly what it was and the pecking-order argument above still
 * holds.
 *
 * This does not make the AI spend more: its `VALUE_FOR_MONEY` filter caps what it
 * will pay per unit of improvement, so a career at 4×, 6× or 10× this figure
 * produces an identical league. The money is headroom for the manager.
 *
 * **M5a kept this as the opening balance** rather than deleting it. Revenue is
 * now the ongoing source — gate receipts, TV, sponsorship and prize money, minus
 * wages — but a career still has to start somewhere, and this figure is
 * calibrated and pinned by the human market harness. Replacing the seed and the
 * income in one move would have changed two things and left nothing to measure
 * the result against.
 */
function seedBudget(attack: number, defence: number): number {
  const rating = (attack + defence) / 2
  return Math.round(2400 * Math.pow(rating / 50, 4))
}

export const DEFAULT_CLUBS: readonly Club[] = CLUBS.map(
  ([id, name, shortName, attack, defence]) => ({
    id: id as ClubId,
    name,
    shortName,
    attack,
    defence,
    budget: seedBudget(attack, defence),
    capacity: seedCapacity(attack, defence),
    ticketPrice: FINANCE.TICKET,
    expansion: null,
    ledger: EMPTY_LEDGER,
    lastLedger: EMPTY_LEDGER,
  }),
)
