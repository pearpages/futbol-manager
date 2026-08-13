import type { Club, ClubId } from './entities.ts'

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
 */
const RATINGS: readonly (readonly [number, number])[] = [
  [88, 85],
  [86, 82],
  [80, 86],
  [76, 74],
  [73, 72],
  [70, 74],
  [68, 66],
  [67, 64],
  [66, 67],
  [65, 65],
  [65, 61],
  [64, 66],
  [63, 64],
  [61, 63],
  [59, 60],
  [58, 58],
  [57, 56],
  [54, 53],
  [52, 51],
  [49, 50],
]

export const TEST_CLUBS: readonly Club[] = RATINGS.map(([attack, defence], i) => ({
  id: `c${String(i + 1).padStart(2, '0')}` as ClubId,
  name: `Club ${i + 1}`,
  shortName: `C${String(i + 1).padStart(2, '0')}`,
  attack,
  defence,
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
