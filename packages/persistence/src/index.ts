import type { RngState } from '@fm/domain'

/**
 * Bumped by every schema change, each of which ships a migration and a round-trip
 * test against the previous version's fixture save. See docs/adr/0005-persistence.md.
 */
export const SCHEMA_VERSION = 1

/**
 * The envelope every save is wrapped in. Ground rule 3 — `schemaVersion` is present
 * from the very first save file, not added once it hurts.
 *
 * `rngState` is not optional and not an afterthought: a save that omits it silently
 * breaks determinism on reload, which is the one bug class this whole design exists
 * to prevent.
 */
export interface SaveEnvelope<T> {
  readonly schemaVersion: number
  readonly rngState: RngState
  readonly payload: T
}

export function wrapSave<T>(payload: T, rngState: RngState): SaveEnvelope<T> {
  return { schemaVersion: SCHEMA_VERSION, rngState, payload }
}
