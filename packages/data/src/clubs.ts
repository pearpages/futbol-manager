import { type Club, type ClubId, EMPTY_LEDGER, FINANCE } from '@fm/domain'

/**
 * Twenty-five clubs named after their cities, of which twenty play.
 *
 * **A club is its city.** Where a city fields more than one club, the second takes
 * the name of the district or ground it is identified with — Manzanares, Heliópolis,
 * Sarrià, Vallecas, Benicalap. A supporter places those instantly, and they read as
 * club names in a table, which crowd nicknames ("Colchoneros", "Periquitos") do not.
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
 * `[id, name, shortName, attack, defence, capacity, inLeague]`.
 *
 * Ratings are **provisional and M2-only** — they stand in for squads until players
 * exist at M3, where the rating is derived from the selected XI instead.
 *
 * **Both rating columns are derived from real squad market values**, not hand-tuned.
 * They used to be hand-tuned, and the comment here used to argue for the *shape* it
 * was imitating — "two or three clubs clear of the rest, a broad middle where a few
 * rating points separate seventh from fourteenth, and a weak tail." That shape was a
 * reasonable guess and it was wrong in places: it put Sevilla eight points above
 * Villarreal, where the real figures are €324.6M against €128.9M.
 *
 * This is the same correction `capacity` already had. Nothing about the *scale*
 * changed — the mapping is anchored so the strongest club is 86.5 overall and the
 * weakest 49.5, exactly the range the hand-tuned table spanned, so only the ordering
 * and the spacing moved:
 *
 * ```
 * overall = 49.5 + 37 × (ln V − ln 38.63) / (ln 1450 − ln 38.63)
 * ```
 *
 * **Attack and defence split off that overall using the club's own share of squad
 * value in attacking versus defensive positions**, weighted by the resolver's own
 * `ATTACK_SHARE`/`DEFENCE_SHARE` from `lineup.ts` — so the split means the thing the
 * rating collapse actually measures. The raw figure reads defensive for every club,
 * because a squad holds far more defenders than strikers while a defender counts 0.15
 * toward attack; that systematic part is an artefact of squad composition and is
 * centred out, leaving only how a club differs from the league. Sevilla lands 59/64
 * on a squad with almost no forward value; Getafe 61/55 on four strikers and a thin
 * defence. Madrid derives to 88/85 — the hand-tuned figure exactly, which is the best
 * evidence available that the method is sound.
 *
 * **If a band moves, retune the mapping, never a row.** Swapping `ln V` for `V^k`
 * moves the whole curve on one number; editing one club reintroduces precisely the
 * guessing this column exists to remove.
 *
 * **Capacity is the real seat count of the ground each city plays at**, not a
 * number derived from the rating. It used to be the latter — `seedCapacity`, a
 * convex curve on rating — which put 1.20M seats in a league that has 776k, made
 * Madrid's ground 45% larger than it is, and, worse, made capacity a second copy
 * of the rating.
 *
 * **So capacity deliberately no longer tracks strength, because real grounds do
 * not.** Heliópolis has a bigger stadium than Sevilla despite a lower rating, and
 * Vigo has 70% more seats than Girona. Those inversions are the fact, not typos —
 * do not "fix" them, and do not re-derive this column from anything. A ground is the
 * one thing about a club that is inherited rather than earned, which is exactly why
 * it makes the gate interesting.
 *
 * **`inLeague` selects the twenty that play.** The other five are real clubs in the
 * second tier; they are kept because they were here before and because M7 needs
 * somewhere for a second division to come from. **This is not that abstraction** —
 * there is no division field, no second competition and no promotion. It is a list
 * of clubs of which twenty are chosen.
 *
 * Note Girona would rank twelfth on rating if it played: the second tier is not
 * uniformly weaker than the first, and the real figure says so. The five out-of-league
 * clubs carry no attack/defence split, because no roster was fetched for a club
 * nothing generates squads for — they are flat until something needs them.
 *
 * **Ordering is descending by rating and that is load-bearing twice over**: ids seed
 * fixture generation, and `TEST_CLUBS` in `@fm/domain` documents index 0 as the
 * strongest, which several tests rely on. Filtering by `inLeague` preserves the
 * descending order. `TEST_CLUBS` mirrors the **in-league rows** index for index so
 * the harness measures the league the game actually ships. **Change one and change
 * the other.**
 *
 * Values verified 2026-08-15 against Transfermarkt's ES1/ES2 market-value tables;
 * capacities against the Wikipedia season page.
 */
const CLUBS: readonly (readonly [string, string, string, number, number, number, boolean])[] = [
  // Contenders
  ['madrid', 'Madrid', 'MAD', 89, 87, 83_186, true],
  ['barcelona', 'Barcelona', 'BAR', 87, 88, 105_000, true],
  ['manzanares', 'Manzanares', 'MZN', 85, 84, 70_692, true], // Madrid's second club
  // European places
  ['villarreal', 'Villarreal', 'VLL', 80, 81, 23_500, true],
  ['san-sebastian', 'San Sebastián', 'SSB', 80, 79, 40_000, true],
  ['bilbao', 'Bilbao', 'BIL', 79, 80, 53_331, true],
  ['heliopolis', 'Heliópolis', 'HEL', 79, 79, 60_270, true], // Sevilla's second club
  // The broad middle — a few points apart, so finishing order here is mostly form
  ['vigo', 'Vigo', 'VIG', 76, 78, 24_870, true],
  ['sevilla', 'Sevilla', 'SEV', 75, 77, 43_864, true],
  ['valencia', 'Valencia', 'VAL', 76, 75, 49_430, true],
  ['sarria', 'Sarrià', 'SAR', 75, 76, 38_529, true], // Barcelona's second club
  ['girona', 'Girona', 'GIR', 75, 75, 14_624, false],
  ['getafe', 'Getafe', 'GET', 75, 73, 17_393, true],
  ['benicalap', 'Benicalap', 'BEN', 75, 73, 26_354, true], // Valencia's second club
  ['a-coruna', 'A Coruña', 'COR', 74, 74, 32_490, true],
  ['santander', 'Santander', 'SAN', 74, 74, 22_514, true],
  // Strugglers
  ['elche', 'Elche', 'ELC', 73, 74, 33_732, true],
  ['vallecas', 'Vallecas', 'VAS', 73, 74, 14_708, true], // Madrid's third club
  ['pamplona', 'Pamplona', 'PAM', 72, 74, 23_576, true],
  ['vitoria', 'Vitoria', 'VIT', 73, 73, 19_840, true],
  ['almeria', 'Almería', 'ALM', 71, 71, 21_350, false],
  ['palma', 'Palma', 'PAL', 70, 70, 25_736, false],
  // The tail
  ['malaga', 'Málaga', 'MAL', 71, 69, 30_778, true],
  ['cadiz', 'Cádiz', 'CAD', 67, 67, 25_033, false],
  ['granada', 'Granada', 'GRA', 65, 65, 21_600, false],
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
  return Math.round(2400 * Math.pow((rating - 45.08) / 24.96, 4))
}

function toClub([id, name, shortName, attack, defence, capacity]: (typeof CLUBS)[number]): Club {
  return {
    id: id as ClubId,
    name,
    shortName,
    attack,
    defence,
    budget: seedBudget(attack, defence),
    capacity,
    ticketPrice: FINANCE.TICKET,
    expansion: null,
    ledger: EMPTY_LEDGER,
    lastLedger: EMPTY_LEDGER,
  }
}

/**
 * Every club the game knows about, strongest first — including the five currently
 * in the second tier. Nothing generates a season from this; it exists so the clubs
 * that left the division are still somewhere when M7 wants a second one.
 */
export const ALL_CLUBS: readonly Club[] = CLUBS.map(toClub)

/**
 * The twenty that play, still strongest first.
 *
 * `inLeague` lives in the tuple above and **never on the `Club` entity**, which is
 * why adding it needed no schema bump, no migration and no fixture: nothing here is
 * persisted that was not persisted before. A save carries its own clubs array, so an
 * existing career keeps the league it started with.
 */
export const DEFAULT_CLUBS: readonly Club[] = CLUBS.filter(
  ([, , , , , , inLeague]) => inLeague,
).map(toClub)
