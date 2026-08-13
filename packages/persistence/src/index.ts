import type { RngState } from '@fm/domain'
import { migratePayload, SCHEMA_VERSION } from './migrations.ts'

export {
  MIGRATIONS,
  type Migration,
  migratePayload,
  needsSquads,
  SCHEMA_VERSION,
} from './migrations.ts'

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

/**
 * Reads a save of any known version and returns it at the current one.
 *
 * The payload comes back as `unknown` deliberately: migration cannot prove the
 * result matches the caller's expected type, and pretending otherwise with a cast
 * inside here would hide exactly the bug this machinery exists to catch. The
 * caller asserts the shape once, at a single known place.
 */
export function readSave(envelope: SaveEnvelope<unknown>): SaveEnvelope<unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    rngState: envelope.rngState,
    payload: migratePayload(envelope.payload, envelope.schemaVersion),
  }
}
