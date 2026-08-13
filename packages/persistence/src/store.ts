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
 */

const DB_NAME = 'futbol-manager'
const DB_VERSION = 1
const STORE = 'saves'

/** One slot for now. Named slots arrive when there is a reason for more than one. */
export const AUTOSAVE_SLOT = 'autosave'

let connection: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  connection ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
    },
  })
  return connection
}

export async function saveGame(payload: unknown, rngState: RngState, slot = AUTOSAVE_SLOT) {
  await (await db()).put(STORE, wrapSave(payload, rngState), slot)
}

/**
 * Returns the migrated save, or `null` when the slot is empty — an empty slot is a
 * normal state (a new player), not an error.
 */
export async function loadGame(slot = AUTOSAVE_SLOT): Promise<SaveEnvelope<unknown> | null> {
  const stored = (await (await db()).get(STORE, slot)) as SaveEnvelope<unknown> | undefined
  return stored === undefined ? null : readSave(stored)
}

export async function deleteGame(slot = AUTOSAVE_SLOT): Promise<void> {
  await (await db()).delete(STORE, slot)
}

/** JSON export — the backup path, and what a bug report should attach. */
export function exportSave(payload: unknown, rngState: RngState): string {
  return JSON.stringify(wrapSave(payload, rngState), null, 2)
}

/** Import is a load, so it migrates too: a shared file may be several versions old. */
export function importSave(json: string): SaveEnvelope<unknown> {
  return readSave(JSON.parse(json) as SaveEnvelope<unknown>)
}
