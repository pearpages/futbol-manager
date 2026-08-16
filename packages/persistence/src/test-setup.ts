// `/auto` rather than the named export alone: `idb` reaches for `IDBRequest` and
// `IDBTransaction` as globals to wrap them, so handing over only `indexedDB`
// fails at the first call with a bare ReferenceError.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach } from 'vitest'
import { closeDb } from './store.ts'

/**
 * A real IndexedDB implementation for the tests.
 *
 * Neither Node nor jsdom ships one, which is why `store.ts` had never had a test
 * until named save slots arrived: `restore()` treats a missing database as a
 * normal state — private browsing, a blocked origin — and swallows it, so the
 * whole storage layer failed silently and correctly and was never exercised.
 *
 * A fresh factory per test rather than deleting databases, because a save picker
 * test that inherits the previous test's slots is a test asserting the wrong
 * thing. `closeDb()` first: the connection is a memoised module-level promise, and
 * a live handle to a database this line is about to replace blocks every call
 * after it.
 */
beforeEach(() => {
  closeDb()
  globalThis.indexedDB = new IDBFactory()
})
