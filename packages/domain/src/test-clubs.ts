import type { Club, ClubId } from './entities.ts'
import { EMPTY_LEDGER, FINANCE } from './finance.ts'

/**
 * A 20-club league for tests. Not exported from the package index — `domain` must
 * not ship content, and it cannot import `@fm/data` (that would reverse the
 * dependency direction), so the fixture lives here.
 *
 * The spread deliberately mirrors the shape of a real top division rather than a
 * uniform ramp: a few contenders, a broad middle where finishing order is mostly
 * variance, and a weak tail. The harness asserts that strong clubs finish high on
 * average, which only means something against a spread like this.
 *
 * Index 0 is the strongest and index 19 the weakest — several tests rely on that
 * ordering to check rating against finishing position.
 *
 * `[attack, defence, capacity]`, mirroring `CLUBS` in `@fm/data` row for row.
 *
 * **The seat counts are the real grounds, copied verbatim, and they must stay in
 * step with the ones in `@fm/data` — change one list and change the other.** Every
 * harness band runs on this copy, including M5a's economy criterion, which asks
 * whether any club goes bankrupt or banks an unspendable fortune; gate receipts are
 * `capacity × occupancy × price`, so a league whose grounds are the wrong size is a
 * league the harness cannot speak for.
 *
 * **Capacity deliberately does not track rating**, for the reasons set out in
 * `@fm/data`: index 9 has 70% more seats than index 10 despite being two rating
 * points apart, and index 8 outsizes index 3 outright. Those inversions are copied
 * on purpose.
 */
const CLUBS: readonly (readonly [number, number, number])[] = [
  [88, 85, 83_186],
  [86, 82, 105_000],
  [80, 86, 70_692],
  [76, 74, 43_864],
  [73, 72, 53_331],
  [70, 74, 40_000],
  [68, 66, 49_430],
  [67, 64, 23_500],
  [66, 67, 60_270],
  [65, 65, 24_870],
  [65, 61, 14_624],
  [64, 66, 23_576],
  [63, 64, 25_736],
  [61, 63, 38_529],
  [59, 60, 17_393],
  [58, 58, 19_840],
  [57, 56, 14_708],
  [54, 53, 25_033],
  [52, 51, 21_600],
  [49, 50, 21_350],
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
  budget: Math.round(2400 * Math.pow((attack + defence) / 100, 4)),
  capacity,
  ticketPrice: FINANCE.TICKET,
  expansion: null,
  ledger: EMPTY_LEDGER,
  lastLedger: EMPTY_LEDGER,
}))

/** All clubs identical — isolates variance from rating effects. */
export const EVEN_CLUBS: readonly Club[] = TEST_CLUBS.map((club) => ({
  ...club,
  attack: 65,
  defence: 65,
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
