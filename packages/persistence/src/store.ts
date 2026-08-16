import { openDB, type IDBPDatabase } from 'idb'
import { type SaveEnvelope, readSave, wrapSave } from './index.ts'
import type { RngState } from '@fm/domain'

/**
 * Save and load, against IndexedDB.
 *
 * Until M3b this package could describe a save but not write one. A game you
 * cannot save is not playable in the sense ground rule 6 means, so the screens and
 * the store landed together.
 *
 * IndexedDB rather than `localStorage`: a save is thousands of players by M7, and
 * `localStorage` is a synchronous 5MB string store. Everything crossing this
 * boundary goes through {@link readSave}, so a save written by any past version is
 * migrated exactly once, in one place.
 *
 * **`DB_VERSION` is not `schemaVersion`.** This one versions the *shape of the
 * database* — which object stores exist — and IndexedDB owns the upgrade. The
 * payload's own version lives in the envelope and is migrated by `migrations.ts`.
 * The two move independently: adding the summaries store below bumped this and
 * left `SCHEMA_VERSION` alone, because no saved game changed.
 */

const DB_NAME = 'futbol-manager'
/** Exported so a test can stage a database one version ahead of this build. */
export const DB_VERSION = 2
const STORE = 'saves'

/**
 * Slot summaries — one small record per save, keyed by the same slot.
 *
 * A second store rather than reading the envelopes: a save is ~165 KB and holds
 * five hundred players, and the picker asks for the whole list every time it
 * opens. Deserialising ten squads to draw ten rows is the wrong shape. A summary
 * is a couple of hundred bytes.
 */
const SUMMARIES = 'slots'

/**
 * Where a career lands when nobody named it.
 *
 * Still the slot `restore()` falls back to, so a career that predates named saves
 * is picked up exactly as it always was. It carries no summary, so it does not
 * appear in the picker until it is saved under a name — deliberate: the
 * alternative is deriving a summary inside an IndexedDB upgrade callback, from a
 * payload that has not been migrated yet.
 */
export const AUTOSAVE_SLOT = 'autosave'

/**
 * What the picker shows for one save, without opening it.
 *
 * Supplied by the caller, never derived here. Which club, which matchday and what
 * the date is are all domain questions the app already asks — `persistence` knows
 * about envelopes, not about football.
 */
export interface SaveSummary {
  readonly slot: string
  /** What the player typed. Unique: it *is* the slot, modulo the prefix. */
  readonly name: string
  readonly clubName: string
  /** A `DayNumber`. Orders the list, and is what the description renders. */
  readonly currentDate: number
  /** The round about to be played, or `null` once the season is over. */
  readonly round: number | null
}

/** Everything a caller supplies; the slot is derived from the name. */
export type SaveDetails = Omit<SaveSummary, 'slot'>

const NAMED_PREFIX = 'named:'

/**
 * The slot a name is stored at.
 *
 * The key *is* the name, so saving under a name that already exists overwrites it
 * — which is what a player means by it — and there is no id to generate, no
 * counter to keep and no randomness anywhere. The prefix is what keeps a save
 * called "autosave" from landing on the unnamed slot.
 */
export function slotFor(name: string): string {
  return `${NAMED_PREFIX}${name.trim()}`
}

/**
 * The name behind a slot, or `null` for the unnamed one.
 *
 * The inverse of {@link slotFor}, and it exists so a quick save can refresh its
 * own summary without first reading the list back — the key already carries
 * everything needed, and asking the database for a fact the string holds is how
 * a stale date ends up on the picker when storage is briefly unavailable.
 */
export function nameFor(slot: string): string | null {
  return slot.startsWith(NAMED_PREFIX) ? slot.slice(NAMED_PREFIX.length) : null
}

let connection: Promise<IDBPDatabase> | null = null

/**
 * Thrown when another tab is holding the database open at an older version.
 *
 * A distinct error rather than a hang, which is the whole point — see `open`.
 */
export class StorageBlockedError extends Error {
  constructor() {
    super('Another tab has this game open. Close it and try again.')
    this.name = 'StorageBlockedError'
  }
}

const STORES = [STORE, SUMMARIES] as const

function upgrade(database: IDBPDatabase): void {
  // Guarded rather than sequenced on `oldVersion`: both stores are created the
  // same way at every version, and a database that already has one is the normal
  // case for anyone upgrading.
  for (const name of STORES) {
    if (!database.objectStoreNames.contains(name)) database.createObjectStore(name)
  }
}

/**
 * Opens the database at `version`, and refuses to wait forever to do it.
 *
 * **A blocked open never settles.** IndexedDB will not run an upgrade while
 * another connection holds the database at an older version; the request simply
 * stays pending, so `await` never returns, and — this is the part that matters —
 * a `try`/`catch` around the caller can never fire, because a hanging promise is
 * not a rejection. The symptom is a save picker that is empty forever with
 * nothing in the console, and a Save button stuck on "Saving…".
 *
 * So `blocked` rejects. `blocking` is the other half: when *this* tab is the one
 * in the way, it closes its own handle and drops the memo so the next call
 * reopens, which lets a second tab upgrade instead of deadlocking against us.
 */
function open(version: number): Promise<IDBPDatabase> {
  return openDB(DB_NAME, version, {
    upgrade,
    blocked() {
      throw new StorageBlockedError()
    },
    blocking() {
      closeDb()
    },
    terminated() {
      // The browser dropped the connection under us — a tab discard, or storage
      // being cleared. Forget it so the next call opens a fresh one.
      connection = null
    },
  })
}

function db(): Promise<IDBPDatabase> {
  connection ??= open(DB_VERSION)
    .then(async (database) => {
      // A database can sit at the current version and still be missing a store:
      // IndexedDB only runs `upgrade` on a version *change*, so a build that
      // bumped the version before the store landed leaves one that can never
      // heal itself — every read throws `NotFoundError` for good. Reopening one
      // version higher runs `upgrade` again, which is idempotent.
      if (STORES.every((name) => database.objectStoreNames.contains(name))) return database
      const repaired = database.version + 1
      database.close()
      return open(repaired)
    })
    .catch((reason: unknown) => {
      // Never memoise a rejection. One transient failure — private browsing, a
      // blocked origin, another tab mid-upgrade — would otherwise poison every
      // later call for the lifetime of the page, and the retry that would have
      // worked never gets made.
      connection = null
      throw reason
    })
  return connection
}

/**
 * Drops the memoised connection.
 *
 * Used by tests, which reset the IndexedDB factory between cases — a live handle
 * to a database that no longer exists blocks every call after the first — and by
 * `blocking`, where this tab is what stands between another one and its upgrade.
 */
export function closeDb(): void {
  const open = connection
  connection = null
  void open?.then(
    (database) => {
      database.close()
    },
    () => {
      // Already failed; there is nothing to close.
    },
  )
}

/**
 * Writes the save, and its summary when there is one.
 *
 * Both stores in one transaction: a summary whose envelope is missing is a row in
 * the picker that cannot be loaded, and an envelope with no summary is a save
 * nobody can find.
 */
export async function saveGame(
  payload: unknown,
  rngState: RngState,
  slot = AUTOSAVE_SLOT,
  details?: SaveDetails,
) {
  const transaction = (await db()).transaction([STORE, SUMMARIES], 'readwrite')
  await transaction.objectStore(STORE).put(wrapSave(payload, rngState), slot)
  if (details !== undefined) {
    await transaction.objectStore(SUMMARIES).put({ ...details, slot } satisfies SaveSummary, slot)
  }
  await transaction.done
}

/**
 * Returns the migrated save, or `null` when the slot is empty — an empty slot is a
 * normal state (a new player), not an error.
 */
export async function loadGame(slot = AUTOSAVE_SLOT): Promise<SaveEnvelope<unknown> | null> {
  const stored = (await (await db()).get(STORE, slot)) as SaveEnvelope<unknown> | undefined
  return stored === undefined ? null : readSave(stored)
}

/**
 * Every named save, newest in-game date first.
 *
 * Ordering by `currentDate` rather than by when the file was written, because
 * nothing in this codebase reads the system clock — the day clock is state. Two
 * careers started separately both open on the same date, so ties are the normal
 * case and the name breaks them; the caller collates it, since a locale decides
 * how.
 */
export async function listSaves(): Promise<readonly SaveSummary[]> {
  const rows = (await (await db()).getAll(SUMMARIES)) as SaveSummary[]
  return rows.sort((a, b) => b.currentDate - a.currentDate)
}

export async function deleteGame(slot = AUTOSAVE_SLOT): Promise<void> {
  const transaction = (await db()).transaction([STORE, SUMMARIES], 'readwrite')
  await transaction.objectStore(STORE).delete(slot)
  await transaction.objectStore(SUMMARIES).delete(slot)
  await transaction.done
}

/** JSON export — the backup path, and what a bug report should attach. */
export function exportSave(payload: unknown, rngState: RngState): string {
  return JSON.stringify(wrapSave(payload, rngState), null, 2)
}

/** Import is a load, so it migrates too: a shared file may be several versions old. */
export function importSave(json: string): SaveEnvelope<unknown> {
  return readSave(JSON.parse(json) as SaveEnvelope<unknown>)
}
