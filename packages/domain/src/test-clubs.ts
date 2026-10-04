import type { GameState } from './state.ts'
import type { Club, ClubId } from './entities.ts'
import { COUNTRIES, type Country, type ForeignClub } from './foreign.ts'
import { EMPTY_LEDGER, FINANCE } from './finance.ts'

/**
 * A 20-club league for tests. Not exported from the package index — `domain` must
 * not ship content, and it cannot import `@fm/data` (that would reverse the
 * dependency direction), so the fixture lives here.
 *
 * The spread is not a designed shape any more: **both rating columns are derived
 * from real squad market values**, so the league is top-heavy because real leagues
 * are, rather than because someone laid out a curve they thought looked right. The
 * harness asserts that strong clubs finish high on average, which only means
 * something against a spread with real structure in it.
 *
 * Index 0 is the strongest and index 19 the weakest — several tests rely on that
 * ordering to check rating against finishing position.
 *
 * `[attack, defence, capacity]`, mirroring the **in-league rows** of `CLUBS` in
 * `@fm/data` row for row. That list holds twenty-five clubs and marks twenty of them
 * `inLeague`; the five it leaves out are second-tier and are not represented here,
 * because nothing generates a season from them.
 *
 * **The seat counts are the real grounds, copied verbatim, and they must stay in
 * step with the ones in `@fm/data` — change one list and change the other.** Every
 * harness band runs on this copy, including M5a's economy criterion, which asks
 * whether any club goes bankrupt or banks an unspendable fortune; gate receipts are
 * `capacity × occupancy × price`, so a league whose grounds are the wrong size is a
 * league the harness cannot speak for.
 *
 * **Capacity deliberately does not track rating**, for the reasons set out in
 * `@fm/data`: index 19 is the weakest club in the division and has the sixth-largest
 * ground, and index 16 outsizes index 8 outright. Those inversions are copied on
 * purpose.
 */
const CLUBS: readonly (readonly [number, number, number])[] = [
  [89, 87, 83_186],
  [87, 88, 105_000],
  [85, 84, 70_692],
  [80, 81, 23_500],
  [80, 79, 40_000],
  [79, 80, 53_331],
  [79, 79, 60_270],
  [76, 78, 24_870],
  [75, 77, 43_864],
  [76, 75, 49_430],
  [75, 76, 38_529],
  [75, 73, 17_393],
  [75, 73, 26_354],
  [74, 74, 32_490],
  [74, 74, 22_514],
  [73, 74, 33_732],
  [73, 74, 14_708],
  [72, 74, 23_576],
  [73, 73, 19_840],
  [71, 69, 30_778],
]

export const TEST_CLUBS: readonly Club[] = CLUBS.map(([attack, defence, capacity], i) => ({
  id: `c${String(i + 1).padStart(2, '0')}` as ClubId,
  name: `Club ${i + 1}`,
  shortName: `C${String(i + 1).padStart(2, '0')}`,
  attack,
  defence,
  // Same convex shape *and* the same scale as the real clubs — see `seedBudget`
  // in @fm/data. Budgets must reflect the pecking order or a decade of transfers
  // inverts the table, and they must be large enough relative to `askingPrice`
  // that a signing which improves the XI is reachable at all.
  budget: Math.round(2400 * Math.pow(((attack + defence) / 2 - 45.08) / 24.96, 4)),
  capacity,
  ticketPrice: FINANCE.TICKET,
  expansion: null,
  ledger: EMPTY_LEDGER,
  lastLedger: EMPTY_LEDGER,
}))

/** All clubs identical — isolates variance from rating effects. */
export const EVEN_CLUBS: readonly Club[] = TEST_CLUBS.map((club) => ({
  ...club,
  attack: 77,
  defence: 77,
}))

/**
 * Enough distinct names to fill twenty squads. Generic on purpose — `domain` ships
 * no content, and the real Spanish pools live in `@fm/data`, which `domain` cannot
 * import (wrong direction).
 */
export const TEST_NAMES: readonly string[] = Array.from(
  { length: 600 },
  (_, i) => `Player ${i + 1}`,
)

/**
 * A stand-in foreign league for the harness, mirroring the shape `@fm/data` ships.
 *
 * **`domain` cannot import `@fm/data`**, so this duplicates the shipped list's
 * *shape* the way `TEST_CLUBS` duplicates `CLUBS` — eight countries, four clubs
 * each, ratings spanning the domestic range from above it to the middle of it.
 * **Change one and change the other**: this duplication has already cost this
 * project a real finding once, when the harness measured generated squads while
 * the game shipped real ones.
 *
 * It is used by `market.foreign.harness.test.ts` and by nothing else. Every other
 * harness runs with no foreign clubs, which is what keeps the calibrated M2/M3/M5
 * bands measuring the division they have always measured.
 */
export const TEST_FOREIGN_CLUBS: readonly ForeignClub[] = COUNTRIES.flatMap((country, c) =>
  [88, 84, 80, 75].map((rating, i) => ({
    id: `${country.toLowerCase()}-f${String(i + 1)}` as ClubId,
    name: `${country} Club ${String(i + 1)}`,
    shortName: `${country}${String(i + 1)}`,
    country,
    rating: rating - c,
    budget: Math.round(2400 * Math.pow((rating - c - 45.08) / 24.96, 4)),
  })),
)

/** Name pools per country for the harness, generic for the same reason as `TEST_NAMES`. */
const poolFor = (country: Country): readonly string[] =>
  Array.from({ length: 400 }, (_, i) => `${country} Player ${String(i + 1)}`)

export const TEST_INTL_NAMES: Readonly<Record<Country, readonly string[]>> = {
  EN: poolFor('EN'),
  DE: poolFor('DE'),
  FR: poolFor('FR'),
  IT: poolFor('IT'),
  PT: poolFor('PT'),
  NL: poolFor('NL'),
  BE: poolFor('BE'),
  TR: poolFor('TR'),
}

/**
 * The manager given their job back, for a test that plays several seasons.
 *
 * `StartNewSeason` refuses a sacked manager. A test that measures the market over
 * a career is not about the board, so it reinstates them first. Nothing in the
 * rollover reads `sacked`, so this changes no draw and no outcome.
 */
export function reinstated(state: GameState): GameState {
  return state.board.sacked ? { ...state, board: { ...state.board, sacked: false } } : state
}
