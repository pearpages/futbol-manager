import { deleteDB, openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { createRng } from '@fm/domain'
import v7 from './fixtures/v7.json' with { type: 'json' }
import { SCHEMA_VERSION, type SaveEnvelope } from './index.ts'
import {
  AUTOSAVE_SLOT,
  DB_VERSION,
  deleteGame,
  listSaves,
  loadGame,
  type SaveDetails,
  saveGame,
  slotFor,
} from './store.ts'

/**
 * The storage layer, exercised for the first time.
 *
 * It shipped at M3b and was never covered, because neither Node nor jsdom
 * implements IndexedDB and `restore()` treats a missing database as a normal
 * state — so every call failed silently and correctly. `fake-indexeddb` is what
 * closes that; `test-setup.ts` hands each test a fresh, empty database.
 */

const rngState = createRng(2026).state()

/** Duplicated on purpose; these tests stage databases the public door cannot. */
const DB_NAME = 'futbol-manager'

/**
 * Writes an envelope into the store without going through `saveGame`.
 *
 * This is the one test that needs to write something `saveGame` refuses to — an
 * envelope stamped with a version older than the current one. Everything else
 * goes through the public door.
 */
async function putRaw(slot: string, envelope: SaveEnvelope<unknown>): Promise<void> {
  const db = await openDB(DB_NAME, 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('saves')) database.createObjectStore('saves')
      if (!database.objectStoreNames.contains('slots')) database.createObjectStore('slots')
    },
  })
  await db.put('saves', envelope, slot)
  db.close()
}

const details = (over: Partial<SaveDetails> = {}): SaveDetails => ({
  name: 'Temporada 1',
  clubName: 'Sarrià',
  currentDate: 46_600,
  round: 6,
  ...over,
})

describe('slots', () => {
  it('keys a named save on the name itself, out of reach of the unnamed slot', () => {
    // The prefix is the whole reason a save called "autosave" cannot land on the
    // slot a career without a name lives in.
    expect(slotFor('Temporada 1')).not.toBe(AUTOSAVE_SLOT)
    expect(slotFor('autosave')).not.toBe(AUTOSAVE_SLOT)
    expect(slotFor('Temporada 1')).toBe(slotFor('  Temporada 1  '))
  })
})

describe('saving and loading', () => {
  it('returns null for a slot nobody has written — an empty slot is not an error', async () => {
    expect(await loadGame()).toBeNull()
    expect(await loadGame(slotFor('nothing here'))).toBeNull()
  })

  it('round-trips a payload through the database', async () => {
    await saveGame({ day: 42 }, rngState)

    const loaded = await loadGame()
    expect(loaded?.payload).toEqual({ day: 42 })
    expect(loaded?.rngState).toEqual(rngState)
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('keeps named slots apart from each other and from the unnamed one', async () => {
    await saveGame({ which: 'auto' }, rngState)
    await saveGame({ which: 'first' }, rngState, slotFor('first'), details({ name: 'first' }))
    await saveGame({ which: 'second' }, rngState, slotFor('second'), details({ name: 'second' }))

    expect((await loadGame())?.payload).toEqual({ which: 'auto' })
    expect((await loadGame(slotFor('first')))?.payload).toEqual({ which: 'first' })
    expect((await loadGame(slotFor('second')))?.payload).toEqual({ which: 'second' })
  })

  it('migrates on the way out, so a save from an older build loads at the current version', async () => {
    // The envelope goes in raw, because that is the only way to have an *old* one
    // in the database — `saveGame` stamps the current version on everything it
    // writes. Same reason `scripts/fixture.ts` exists: a migration has to be
    // exercised against data an older build actually wrote.
    const old = v7 as unknown as SaveEnvelope<unknown>
    expect(old.schemaVersion).toBeLessThan(SCHEMA_VERSION)
    await putRaw(AUTOSAVE_SLOT, old)

    const loaded = await loadGame()
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
    // v7 predates the board, so its presence is the migration having run.
    expect((loaded?.payload as { board?: unknown }).board).toBeDefined()
  })
})

describe('the picker', () => {
  it('lists nothing before anything is saved', async () => {
    expect(await listSaves()).toEqual([])
  })

  it('lists a named save with everything the description needs', async () => {
    await saveGame({}, rngState, slotFor('Temporada 1'), details())

    expect(await listSaves()).toEqual([
      {
        slot: slotFor('Temporada 1'),
        name: 'Temporada 1',
        clubName: 'Sarrià',
        currentDate: 46_600,
        round: 6,
      },
    ])
  })

  it('does not list a save nobody named', async () => {
    // The career a player already had when this shipped. It is still what
    // `restore()` falls back to; it appears in the picker once it has a name.
    await saveGame({ day: 1 }, rngState)

    expect(await listSaves()).toEqual([])
    expect(await loadGame()).not.toBeNull()
  })

  it('orders by in-game date, newest first', async () => {
    await saveGame(
      {},
      rngState,
      slotFor('august'),
      details({ name: 'august', currentDate: 46_600 }),
    )
    await saveGame({}, rngState, slotFor('may'), details({ name: 'may', currentDate: 46_900 }))
    await saveGame(
      {},
      rngState,
      slotFor('january'),
      details({ name: 'january', currentDate: 46_750 }),
    )

    expect((await listSaves()).map((s) => s.name)).toEqual(['may', 'january', 'august'])
  })

  it('overwrites both the payload and the summary when a name is reused', async () => {
    await saveGame({ day: 1 }, rngState, slotFor('same'), details({ name: 'same', round: 1 }))
    await saveGame({ day: 9 }, rngState, slotFor('same'), details({ name: 'same', round: 9 }))

    const saves = await listSaves()
    expect(saves).toHaveLength(1)
    expect(saves[0]?.round).toBe(9)
    expect((await loadGame(slotFor('same')))?.payload).toEqual({ day: 9 })
  })
})

describe('the database itself', () => {
  /**
   * The upgrade every existing player actually takes, and the one nothing covered.
   *
   * `test-setup.ts` hands each test a brand new `IDBFactory`, so until this the
   * only database any test ever saw was created at the current version with both
   * stores already in it. A *populated* v1 database being upgraded — which is what
   * sits in the browser of anybody who played before named saves — had never run
   * once. Same discipline as the committed save fixtures: a migration has to be
   * exercised against data an older build wrote.
   */
  it('upgrades a populated v1 database without losing the career in it', async () => {
    const legacy = await openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('saves')
      },
    })
    await legacy.put(
      'saves',
      { schemaVersion: SCHEMA_VERSION, rngState, payload: { day: 7 } },
      AUTOSAVE_SLOT,
    )
    expect([...legacy.objectStoreNames]).toEqual(['saves'])
    legacy.close()

    // First call through the public door is what triggers the upgrade.
    const loaded = await loadGame()

    expect(loaded?.payload).toEqual({ day: 7 })
    expect(await listSaves()).toEqual([])
  })

  /**
   * A database can sit at the current version and still lack a store, because
   * IndexedDB only runs `upgrade` on a version *change*. A build that bumped the
   * version before the store landed leaves exactly this, and every read of the
   * missing store throws `NotFoundError` for good — an empty picker, forever,
   * that no amount of reloading fixes.
   */
  it('repairs a database stuck at the current version with a store missing', async () => {
    const broken = await openDB(DB_NAME, 2, {
      upgrade(database) {
        database.createObjectStore('saves')
      },
    })
    await broken.put(
      'saves',
      { schemaVersion: SCHEMA_VERSION, rngState, payload: { day: 3 } },
      AUTOSAVE_SLOT,
    )
    broken.close()

    // Would throw NotFoundError without the repair.
    expect(await listSaves()).toEqual([])
    expect((await loadGame())?.payload).toEqual({ day: 3 })

    // And it is genuinely usable afterwards, not merely quiet.
    await saveGame({ day: 4 }, rngState, slotFor('after'), details({ name: 'after' }))
    expect((await listSaves()).map((s) => s.name)).toEqual(['after'])
  })

  it('does not memoise a failure, so a later call can still succeed', async () => {
    // One transient rejection used to poison every call for the life of the page:
    // `connection ??= open(...)` kept the rejected promise, and the retry that
    // would have worked was never made.
    //
    // The failure has to be **asynchronous** to exercise that at all. A stub that
    // throws synchronously never gets as far as assigning `connection`, so the
    // memo is not involved and the test passes whether the fix is there or not —
    // which is what the first version of this test did. A database sitting at a
    // *higher* version than the code asks for rejects the way a real one does.
    const ahead = await openDB(DB_NAME, DB_VERSION + 1, {
      upgrade(database) {
        database.createObjectStore('saves')
      },
    })
    ahead.close()

    await expect(listSaves()).rejects.toThrow()

    await deleteDB(DB_NAME)
    expect(await listSaves()).toEqual([])
  })
})

describe('deleting', () => {
  it('removes the payload and the summary together', async () => {
    // A summary whose payload is gone is a row in the picker that cannot be
    // loaded; a payload with no summary is a save nobody can find.
    await saveGame({ day: 1 }, rngState, slotFor('gone'), details({ name: 'gone' }))
    await saveGame({ day: 2 }, rngState, slotFor('kept'), details({ name: 'kept' }))

    await deleteGame(slotFor('gone'))

    expect(await loadGame(slotFor('gone'))).toBeNull()
    expect((await listSaves()).map((s) => s.name)).toEqual(['kept'])
  })

  it('is quiet about a slot that was never there', async () => {
    await expect(deleteGame(slotFor('never existed'))).resolves.toBeUndefined()
  })
})
