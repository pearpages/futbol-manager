import { type ClubId, type Country, type ForeignClub } from '@fm/domain'

/**
 * Thirty-two clubs abroad — the six biggest of each major league and the two
 * biggest of four smaller ones.
 *
 * **A source of players, not a competition.** They have squads and budgets and
 * they trade; they have no fixtures, no table and no screen. See `foreign.ts` in
 * `domain` for why they are deliberately not in `state.clubs`.
 *
 * ## Naming
 *
 * **The city convention of [ADR 0007](../../../docs/adr/0007-intellectual-property.md)
 * applies unchanged**, including its second half: where a city fields more than one
 * of these, the second takes the district or ground it is identified with, exactly
 * as Manzanares, Sarrià and Heliópolis do at home. So London is Islington, Fulham
 * and Tottenham; Manchester keeps its name and its neighbour takes Trafford; Milano
 * keeps its name and its neighbour takes Navigli.
 *
 * **One wrinkle that does not arise in Spain and should be said out loud.** For
 * several of these the city name sits much closer to the club's trading name than
 * `Sevilla` or `Valencia` do — Napoli, Porto, Torino. The reasoning is unchanged
 * (a city is not a trademark; a crest is), and the mitigation is to prefer the
 * **local-language form** — Milano not Milan, München not Munich, Lisboa not
 * Lisbon, Torino not Turin — which is the same thing the convention already does
 * with Sarrià and Girona.
 *
 * ## Ratings
 *
 * Derived from squad market value on the same log curve as `CLUBS`, anchored to
 * the **shipped domestic scale** rather than to the historical one: Madrid at
 * ~€1.45bn maps to 88 and Málaga at ~€39m to 70, giving
 *
 * ```
 * rating = 51.85 + 4.966 × ln(value in €m)
 * ```
 *
 * **The values are approximate.** Transfermarkt is not fetchable by this tooling
 * and its terms prohibit automated extraction; these are the well-known order of
 * these leagues to the nearest plausible figure, which is all a rating curve
 * needs. Thirty-two numbers used to seed a curve are not a reproduction of a
 * database. The *squads* come from Wikipedia — see `foreign-rosters.ts`.
 *
 * The result lands **74–88 against the domestic 70–88**: the top of England sits
 * with Madrid, and the Belgian and Turkish clubs sit around mid-table Spain. That
 * overlap is the point — a market with players you cannot afford *and* players you
 * can.
 *
 * **If a band moves, retune the curve, never a row.** Editing one club
 * reintroduces exactly the guessing the derivation exists to remove.
 */

/** `[id, name, shortName, country, squad market value in €m]`. */
const FOREIGN: readonly (readonly [string, string, string, Country, number])[] = [
  // England
  ['en-islington', 'Islington', 'ISL', 'EN', 1330],
  ['en-manchester', 'Manchester', 'MCR', 'EN', 1240],
  ['en-fulham', 'Fulham', 'FUL', 'EN', 1170],
  ['en-trafford', 'Trafford', 'TRA', 'EN', 892],
  ['en-tottenham', 'Tottenham', 'TOT', 'EN', 832],
  ['en-newcastle', 'Newcastle', 'NEW', 'EN', 690],
  // Germany
  ['de-munchen', 'München', 'MUN', 'DE', 950],
  ['de-dortmund', 'Dortmund', 'DOR', 'DE', 470],
  ['de-leipzig', 'Leipzig', 'LEI', 'DE', 450],
  ['de-leverkusen', 'Leverkusen', 'LEV', 'DE', 420],
  ['de-frankfurt', 'Frankfurt', 'FRA', 'DE', 330],
  ['de-stuttgart', 'Stuttgart', 'STU', 'DE', 290],
  // France
  ['fr-paris', 'Paris', 'PAR', 'FR', 1150],
  ['fr-monaco', 'Monaco', 'MON', 'FR', 400],
  ['fr-marseille', 'Marseille', 'MRS', 'FR', 380],
  ['fr-lyon', 'Lyon', 'LYO', 'FR', 280],
  ['fr-lille', 'Lille', 'LIL', 'FR', 250],
  ['fr-nice', 'Nice', 'NIC', 'FR', 230],
  // Italy
  ['it-milano', 'Milano', 'MIL', 'IT', 640],
  ['it-torino', 'Torino', 'TOR', 'IT', 570],
  ['it-napoli', 'Napoli', 'NAP', 'IT', 560],
  ['it-navigli', 'Navigli', 'NAV', 'IT', 500], // Milano's second club
  ['it-roma', 'Roma', 'ROM', 'IT', 430],
  ['it-bergamo', 'Bergamo', 'BER', 'IT', 400],
  // Portugal
  ['pt-lisboa', 'Lisboa', 'LIS', 'PT', 450],
  ['pt-porto', 'Porto', 'POR', 'PT', 350],
  // Netherlands
  ['nl-amsterdam', 'Amsterdam', 'AMS', 'NL', 300],
  ['nl-eindhoven', 'Eindhoven', 'EIN', 'NL', 280],
  // Belgium
  ['be-brugge', 'Brugge', 'BRU', 'BE', 180],
  ['be-anderlecht', 'Anderlecht', 'AND', 'BE', 90], // a municipality of Brussels
  // Türkiye
  ['tr-istanbul', 'İstanbul', 'IST', 'TR', 280],
  ['tr-kadikoy', 'Kadıköy', 'KAD', 'TR', 270], // İstanbul's second club
]

/** The same anchors `CLUBS` uses, expressed against the shipped rating scale. */
const RATING_INTERCEPT = 51.85
const RATING_SLOPE = 4.966

function ratingFor(value: number): number {
  return Math.round(RATING_INTERCEPT + RATING_SLOPE * Math.log(value))
}

/**
 * Seeded on the same convex curve as `seedBudget`, so a foreign club is as rich
 * relative to its strength as a domestic one.
 *
 * **That is the mechanism keeping cross-border flows two-way**, not a rule saying
 * they must be: a layer that were systematically richer would be a net importer of
 * players and a net exporter of money, and the league total would drift. If the
 * cross-border band ever moves, this curve is the lever.
 */
function budgetFor(rating: number): number {
  return Math.round(2400 * Math.pow((rating - 45.08) / 24.96, 4))
}

export const FOREIGN_CLUBS: readonly ForeignClub[] = FOREIGN.map(
  ([id, name, shortName, country, value]) => {
    const rating = ratingFor(value)
    return { id: id as ClubId, name, shortName, country, rating, budget: budgetFor(rating) }
  },
)
