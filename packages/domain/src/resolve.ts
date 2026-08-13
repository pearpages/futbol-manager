import type { Score, TeamRating } from './entities.ts'
import type { Rng } from './rng.ts'

/**
 * Result resolution — the Poisson goal model.
 *
 * Each side's goals are drawn from a Poisson distribution whose mean is set by its
 * attack against the opponent's defence, plus a home advantage. Poisson is the
 * standard model for football scorelines and it reproduces the things a flat
 * random model cannot: 0–0s and 1–0s are common, 5–4s are rare but possible, and
 * a strong side beats a weak one *usually* rather than always.
 *
 * The mean is computed on a log scale:
 *
 *   λ_home = exp(BASE + SLOPE × (home.attack − away.defence) / SCALE + HOME_EDGE)
 *   λ_away = exp(BASE + SLOPE × (away.attack − home.defence) / SCALE)
 *
 * Working in logs means ratings compose multiplicatively — a side twice as good
 * scores proportionally more rather than by a fixed increment — and λ can never go
 * negative however extreme the ratings, which a linear model would allow.
 *
 * The constants below are the knobs this milestone exists to turn. They are
 * calibrated against the N-season harness, not chosen by taste; see
 * simulate.harness.test.ts for the bands they have to satisfy.
 */

/** Calibrated 2026-08-13 against a 50-season run. Change these only with the harness green. */
export const MODEL = {
  /** Sets the overall goal rate. exp(BASE) ≈ goals per side in an even match. */
  BASE: Math.log(1.098),
  /**
   * How much a rating edge is worth. Raising it makes the league more predictable
   * and widens the points spread; lowering it flattens the table toward M1.
   */
  SLOPE: 1.0,
  /** Rating points per unit of SLOPE. Larger = ratings matter less. */
  SCALE: 42,
  /** Log-scale home bonus. exp(0.26) ≈ 1.30, i.e. ~30% more goals at home. */
  HOME_EDGE: 0.26,
  /** Guards the tail: without a cap, an extreme mismatch can produce absurd scorelines. */
  MAX_LAMBDA: 5,
} as const

/** Expected goals for a side. Exported for tests and for M2's calibration work. */
export function expectedGoals(
  attacking: TeamRating,
  defending: TeamRating,
  atHome: boolean,
): number {
  const edge = (attacking.attack - defending.defence) / MODEL.SCALE
  const lambda = Math.exp(MODEL.BASE + MODEL.SLOPE * edge + (atHome ? MODEL.HOME_EDGE : 0))
  return Math.min(lambda, MODEL.MAX_LAMBDA)
}

export function resolveFixture(home: TeamRating, away: TeamRating, rng: Rng): Score {
  return {
    home: poisson(expectedGoals(home, away, true), rng),
    away: poisson(expectedGoals(away, home, false), rng),
  }
}

/**
 * Knuth's method: multiply uniform draws until the product falls below e^−λ, and
 * count. At λ ≈ 1.4 that is two or three draws. It needs nothing but the uniform
 * generator we already have, which keeps `domain` dependency-free and every draw
 * inside the seeded stream.
 */
function poisson(lambda: number, rng: Rng): number {
  const limit = Math.exp(-lambda)
  let count = 0
  let product = rng.next()

  // Bounded purely as a guard against a pathological λ; unreachable in practice
  // because MAX_LAMBDA caps the mean well below this.
  while (product > limit && count < 20) {
    product *= rng.next()
    count++
  }

  return count
}
