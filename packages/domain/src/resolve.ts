import type { Score } from './entities.ts'
import type { Rng } from './rng.ts'

/**
 * Placeholder result resolution — M1's "pure coin flip".
 *
 * Each side draws goals uniformly from 0–3. No squad strength, no home advantage,
 * no correlation between the two sides: that is M2's entire job, and this exists
 * only so the league produces *something* to build the table and the harness on.
 *
 * The signature is the contract M2 inherits: given the two sides and an rng,
 * return a score. When the Poisson model lands, callers do not change.
 */

const MAX_GOALS = 3

export function resolveFixture(rng: Rng): Score {
  return {
    home: goals(rng),
    away: goals(rng),
  }
}

function goals(rng: Rng): number {
  return Math.floor(rng.next() * (MAX_GOALS + 1))
}
