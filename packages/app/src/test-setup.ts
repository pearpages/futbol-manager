import { cleanup } from '@testing-library/react'
// `/auto` rather than the named export alone: `idb` wraps `IDBRequest` and
// `IDBTransaction` off the global, so handing over only `indexedDB` fails at the
// first call with a bare ReferenceError.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach } from 'vitest'
import { closeDb } from '@fm/persistence'
import { useGame } from './store.ts'

/**
 * Testing Library only registers its own auto-cleanup when Vitest globals are on,
 * and they are not — tests import `describe`/`it` explicitly. Without this every
 * `render` stacks into the same document and queries start finding duplicates.
 */
afterEach(cleanup)

/**
 * jsdom has no layout, so it implements no scrolling at all — not even a no-op.
 * A screen that scrolls a panel into view would throw here rather than in a
 * browser, which is a test failing for a reason the product does not have.
 */
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

/**
 * Every test runs in English.
 *
 * The product default is Catalan, and the suite asserts on copy — headings,
 * button labels, the words a notice uses. Pinning the language is the same
 * discipline as pinning the rng seed: the tests are about behaviour, and a
 * behaviour test that also happens to be a translation test fails twice for one
 * reason and tells you neither.
 *
 * `dictionaries.test.ts` is what covers the other two, and `language.test.tsx`
 * covers the switching itself.
 */
beforeEach(() => {
  /*
   * The store is a module-level singleton, so anything a test leaves on it is the
   * next test's starting state. Language is pinned for the reason above; the three
   * storage fields are reset because **swapping the database below can strand an
   * in-flight save**. A `saveGame` still running when the factory is replaced never
   * settles against the old one, so `save()`'s `finally` never fires and `saving`
   * stays true — and the next test finds the hub's button reading "Saving…" and
   * permanently disabled. That cost an afternoon; it is an artefact of swapping
   * storage under a live promise, not something the product can do.
   */
  /*
   * `entry: 'app'` for the same reason as `language`. The landing is the front
   * door now, and a market-screen test that also has to walk through a door fails
   * for a reason it is not about. `LandingScreen.test.tsx` undoes this pin
   * explicitly and walks the door three ways, and it also asserts the *initial*
   * value in `store.ts` — which this line otherwise makes unreadable.
   */
  useGame.setState({
    language: 'en',
    entry: 'app',
    saving: false,
    saves: [],
    currentSlot: null,
  })
  globalThis.localStorage?.removeItem('fm.lastSlot')

  /*
   * A real IndexedDB, fresh per test.
   *
   * jsdom implements none, which every screen test relied on without saying so:
   * `restore()` failed, returned false, and left the fresh season the store had
   * already built. That is still what happens with an empty database, so nothing
   * changes for a test that never saves — but a save picker needs storage that
   * actually stores, and a test inheriting the previous one's slots would be
   * asserting the wrong thing.
   */
  closeDb()
  globalThis.indexedDB = new IDBFactory()
})
