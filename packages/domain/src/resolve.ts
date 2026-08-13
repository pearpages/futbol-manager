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
  /**
   * How much the two sides' tempo opens or smothers a game, applied to *both*
   * expected-goal figures. At 0.60, two teams in a full low block produce
   * exp(−0.60) ≈ 55% of the usual goals; two going all-out produce ~180%.
   *
   * Fewer goals means more draws, and a draw is worth far more to the weaker
   * side — which is what makes the slider a decision instead of a flat cost.
   *
   * Calibrated 2026-08-14 over 40 seasons. The value is a balance between two
   * failures: below ~0.4 the effect is inside the noise and the slider stays
   * decorative; above ~0.9 the strongest club gains 7+ points for simply always
   * maxing out, which is a dominant strategy wearing different clothes. At 0.60
   * the best approach runs cleanly with club strength — Madrid +3.5 attacking,
   * Almería +2.9 defending, mid-table punished either way.
   */
  TEMPO: 0.6,
  /** Guards the tail: without a cap, an extreme mismatch can produce absurd scorelines. */
  MAX_LAMBDA: 5,
} as const

/**
 * Expected goals for a side. Exported for tests and calibration work.
 *
 * `tempo` is deliberately the *average* of both sides rather than the attacking
 * team's alone: one team can slow a game down, but it takes both to make it a
 * shootout. That averaging is why a low block costs the favourite.
 */
export function expectedGoals(
  attacking: TeamRating,
  defending: TeamRating,
  atHome: boolean,
): number {
  const edge = (attacking.attack - defending.defence) / MODEL.SCALE
  const tempo = (attacking.tempo + defending.tempo) / 2
  const lambda = Math.exp(
    MODEL.BASE + MODEL.SLOPE * edge + (atHome ? MODEL.HOME_EDGE : 0) + MODEL.TEMPO * tempo,
  )
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
