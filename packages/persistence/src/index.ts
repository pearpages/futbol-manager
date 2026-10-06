import type { Event, RngState } from '@fm/domain'
import { migratePayload, SCHEMA_VERSION } from './migrations.ts'

export {
  MIGRATIONS,
  type Migration,
  migratePayload,
  needsSquads,
  SCHEMA_VERSION,
} from './migrations.ts'

export {
  AUTOSAVE_SLOT,
  closeDb,
  deleteGame,
  exportSave,
  importSave,
  listSaves,
  loadGame,
  nameFor,
  type SaveDetails,
  type SaveLog,
  type SaveSummary,
  saveGame,
  slotFor,
  StorageBlockedError,
} from './store.ts'

/**
 * The envelope every save is wrapped in. Ground rule 3 — `schemaVersion` is present
 * from the very first save file, not added once it hurts.
 *
 * `rngState` is not optional and not an afterthought: a save that omits it silently
 * breaks determinism on reload, which is the one bug class this whole design exists
 * to prevent.
 *
 * **What belongs out here rather than in the payload**: whatever the save file
 * needs that the *simulation* does not. `rngState` is that shape — `GameState`
 * cannot hold it because the generator is a live object — and so is `feed`.
 * `reduce` emits events and never reads one back, so a log of them is not state;
 * and the cap on how many to keep is a presentation decision that has no business
 * in `domain`.
 *
 * The cost of that choice, stated plainly: **fields out here are not versioned.**
 * `migratePayload` walks `payload` and nothing else. See {@link readSave}.
 */
export interface SaveEnvelope<T> {
  readonly schemaVersion: number
  readonly rngState: RngState
  readonly payload: T
  /**
   * What has happened lately, newest first — the news panel's backing store.
   *
   * Optional because every save written before this existed has none, and an
   * absent log is a normal state rather than a broken one.
   */
  readonly feed?: readonly Event[]
  /** Notable events not yet read. Meaningless without `feed`, and travels with it. */
  readonly unread?: number
}

export function wrapSave<T>(
  payload: T,
  rngState: RngState,
  log?: { readonly feed: readonly Event[]; readonly unread: number },
): SaveEnvelope<T> {
  return {
    schemaVersion: SCHEMA_VERSION,
    rngState,
    payload,
    ...(log === undefined ? {} : { feed: log.feed, unread: log.unread }),
  }
}

/**
 * Reads a save of any known version and returns it at the current one.
 *
 * The payload comes back as `unknown` deliberately: migration cannot prove the
 * result matches the caller's expected type, and pretending otherwise with a cast
 * inside here would hide exactly the bug this machinery exists to catch. The
 * caller asserts the shape once, at a single known place.
 *
 * **The feed is carried, not migrated.** There is no machinery out here that
 * could migrate it, which means a saved log can outlive the `Event` union that
 * produced it. That is survivable only because the reading end treats an
 * unrecognised event as something it has nothing to say about — see
 * `noticesFrom` in the app, which skips anything that is not a real notice.
 */
export function readSave(envelope: SaveEnvelope<unknown>): SaveEnvelope<unknown> {
  // A save is data from outside: IndexedDB can be edited by hand, and an
  // imported file by anyone (security.md). Whatever is wrong is refused here,
  // before it reaches a screen that would crash rendering it.
  if (typeof envelope !== 'object' || envelope === null) throw new Error('This is not a save')
  if (!isRngState(envelope.rngState)) {
    throw new Error('The save’s random generator state is not four 32-bit integers')
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    rngState: envelope.rngState,
    payload: migratePayload(envelope.payload, envelope.schemaVersion),
    feed: Array.isArray(envelope.feed) ? envelope.feed : [],
    unread:
      Number.isInteger(envelope.unread) && (envelope.unread ?? 0) >= 0 ? (envelope.unread ?? 0) : 0,
  }
}

function isRngState(value: unknown): value is RngState {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => Number.isInteger(n) && n >= 0 && n < 2 ** 32)
  )
}
