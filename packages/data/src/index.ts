import { createRng, type Rng } from '@fm/domain'

/**
 * Placeholder until M3, when this package gains the real job: mapping FBref /
 * StatsBomb per-90 stats onto the eight attributes in docs/attribute-model.md.
 *
 * It exists now so the workspace wiring is proven rather than assumed — `data`
 * really can reach `domain`, and the ESLint boundary really does let it.
 */
export function rngFromDatasetSeed(seed: number): Rng {
  return createRng(seed)
}
