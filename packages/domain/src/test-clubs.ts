import type { Club, ClubId } from './entities.ts'
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
