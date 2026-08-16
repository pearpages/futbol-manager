import { create } from 'zustand'
import {
  type Command,
  createRng,
  isSeasonComplete,
  nextFixtureFor,
  type Event,
  type GameState,
  newSeason,
  reduce,
  type Rng,
  type RngState,
} from '@fm/domain'
import { DEFAULT_CLUBS, DEFAULT_ROSTERS, PLAYER_NAMES } from '@fm/data'
import {
  AUTOSAVE_SLOT,
  deleteGame,
  listSaves,
  loadGame,
  nameFor,
  type SaveDetails,
  type SaveSummary,
  saveGame,
  slotFor,
  StorageBlockedError,
} from '@fm/persistence'
import { DEFAULT_LANGUAGE, isLanguage, type Language, translate } from './i18n/index.ts'

/**
 * The UI's view of the game.
 *
 * The store holds *projected* state and dispatches commands — it never mutates
 * game state itself. Ground rule 2 still owns that: every change goes through
 * `reduce`, the same door the statistical harness drives.
 *
 * The rng lives here rather than in `GameState` because it is a live object with
 * an internal cursor, not data. Its *state* is data, and that is what gets saved
 * alongside the payload, so a reload resumes the same stream.
 */

export type Screen =
  'hub' | 'table' | 'squad' | 'lineup' | 'market' | 'player' | 'caja' | 'decisiones' | 'estadio'

interface Store {
  readonly game: GameState
  readonly screen: Screen
  /** Set when a screen opens a ficha; cleared on navigation. */
  readonly inspectedPlayerId: string | null
  /** Which screen the ficha was opened from, so closing it goes back there. */
  readonly inspectedFrom: Screen
  /**
   * A second player laid over the ficha's chart, from your own squad.
   *
   * Store-only, like `screen` and `feed`: it belongs to this sitting rather than to
   * a career, so it stays out of the save envelope and needs no migration.
   */
  readonly comparedPlayerId: string | null
  /** Most recent events, newest first — what the hub's news panel reads. */
  readonly feed: readonly Event[]
  /**
   * The interface language.
   *
   * A third category of state, and the store had only two. `game` belongs to a
   * career and is saved; `screen` and `feed` belong to this sitting and are not.
   * A language belongs to the **player**, across every career — so it outlives
   * both, and lives in `localStorage` rather than the save. Putting it in the
   * envelope would mean deleting a career reset your language, importing a
   * friend's save changed it, and a schema migration for a value with no bearing
   * on the rules.
   */
  readonly language: Language
  readonly saving: boolean
  /**
   * True until a club has been chosen or a save restored. Distinguishes "no
   * career yet" from "career loaded" — without it the app cannot tell whether the
   * state it holds is a real game or the placeholder season built at module load.
   */
  readonly needsSetup: boolean
  /**
   * Every named save, for the picker. Refreshed rather than watched: IndexedDB
   * has no subscription, and the only thing that writes slots is this store.
   */
  readonly saves: readonly SaveSummary[]
  /**
   * The slot this career came from, or was last written to. `null` means it has
   * never been named, in which case it lives in the unnamed slot.
   *
   * Mirrored into `localStorage` for the same reason `language` is: it belongs to
   * the **player** rather than to a career, it has to be readable synchronously
   * before the first `loadGame` can be issued, and putting it in the envelope
   * would mean a save that knows which save it is.
   */
  readonly currentSlot: string | null
  /**
   * Another tab is holding the database at an older version, so nothing could be
   * loaded. Distinct from "no save" because the answer is different: close the
   * other tab, rather than start a career.
   */
  readonly storageBlocked: boolean

  /**
   * Returns the events the reducer emitted, for the caller that needs to react
   * to one *now* rather than read it in the feed later.
   *
   * Most refusals throw, and a screen catches those. But an outcome is not a
   * refusal: offering terms a player turns down returns `TermsRejected` and
   * leaves the state alone, so a screen that only watches for throws sees a
   * button that did nothing. The news drawer used to cover this and the hub's
   * panel does not — it is not on the screen where the press happened.
   */
  dispatch(command: Command): readonly Event[]
  go(screen: Screen): void
  setLanguage(language: Language): void
  /**
   * Run the clock to the day of the next match and stop there, so kicking off
   * stays a separate, deliberate act.
   */
  advanceToMatchday(): void
  inspect(playerId: string | null): void
  /** Lay one of your own players over the ficha's chart, or `null` to clear. */
  compare(playerId: string | null): void
  /** Quick save — writes back to whichever slot this career is in. */
  save(): Promise<void>
  restore(): Promise<boolean>
  /** Reads every named save into `saves`. Safe to call when storage is unavailable. */
  refreshSaves(): Promise<void>
  /** Gives a career from the unnamed slot a name, so the picker can show it. */
  adopt(game: GameState): Promise<void>
  /** Writes this career to a named slot, creating it or overwriting it. */
  saveAs(name: string): Promise<void>
  /** Replaces the current career with a saved one. Returns false if the slot has gone. */
  load(slot: string): Promise<boolean>
  remove(slot: string): Promise<void>
  newGame(managedClubId?: string): void
  /** Back to the club picker, leaving any saved career on disk untouched. */
  restart(): void
  /**
   * Roll into next season. Separate from `dispatch` only because the command
   * carries a name pool, and `domain` owns no word lists — the store is where
   * `@fm/data` is already in scope.
   */
  startNewSeason(): void
}

/**
 * Where the language is kept.
 *
 * `localStorage` rather than IndexedDB precisely because it is synchronous: read
 * at module load, before first paint, so nobody sees a flash of the wrong
 * language. That is the one thing the save store cannot do — `loadGame` is async
 * by construction.
 */
const LANGUAGE_KEY = 'fm.language'

/**
 * Which slot to pick back up on the next visit.
 *
 * Beside the language rather than in the save envelope, and for the same reasons:
 * it is about the player rather than about a career, and it has to be readable
 * *before* the first `loadGame` — a pointer stored inside the thing it points at
 * cannot be followed.
 */
const SLOT_KEY = 'fm.lastSlot'

function readPreference(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    // Private browsing, a blocked origin, or a test environment with no storage.
    // A missing preference is a normal state, exactly as a missing save is.
    return null
  }
}

function writePreference(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // Unavailable storage costs you the preference next time, not this time.
  }
}

function storedLanguage(): Language {
  const saved = readPreference(LANGUAGE_KEY)
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE
}

/**
 * What the picker shows for this career, without opening the save.
 *
 * The round is the one the manager is *about to play* — the same number the title
 * bar shows, so a save's description and the bar can never disagree. `null` once
 * the season is over, which is a real state and not a missing value.
 */
function summaryFor(game: GameState, name: string): SaveDetails {
  return {
    name,
    clubName: game.clubs.find((c) => c.id === game.managedClubId)?.name ?? '',
    currentDate: game.season.currentDate,
    round: nextFixtureFor(game.season.fixtures, game.managedClubId)?.round ?? null,
  }
}

const START_SEED = 20260813

/** Live generator. Rebuilt from saved state on load, never persisted directly. */
let rng: Rng = createRng(START_SEED)

function freshGame(managedClubId?: string): GameState {
  rng = createRng(START_SEED)
  return newSeason(DEFAULT_CLUBS, 2026, {
    names: PLAYER_NAMES,
    rng,
    // Real squad shapes for the opening league. `PLAYER_NAMES` stays: it still
    // names youth intake and free agents at every rollover.
    rosters: DEFAULT_ROSTERS,
    ...(managedClubId === undefined
      ? {}
      : { managedClubId: managedClubId as GameState['managedClubId'] }),
  })
}

export const useGame = create<Store>((set, get) => ({
  game: freshGame(),
  screen: 'hub',
  inspectedPlayerId: null,
  inspectedFrom: 'squad',
  comparedPlayerId: null,
  feed: [],
  language: storedLanguage(),
  saving: false,
  needsSetup: true,
  saves: [],
  currentSlot: readPreference(SLOT_KEY),
  storageBlocked: false,

  dispatch(command) {
    const { state, events } = reduce(get().game, command, rng)
    set({ game: state, feed: [...events, ...get().feed].slice(0, 60) })
    return events
  },

  setLanguage(language) {
    set({ language })
    writePreference(LANGUAGE_KEY, language)
  },

  advanceToMatchday() {
    const target = nextFixtureFor(get().game.season.fixtures, get().game.managedClubId)
    if (target === null) return

    // Stops *on* the fixture date rather than playing it — the match is a
    // separate press. The ceiling guards against a scheduling bug spinning here.
    for (let guard = 0; guard < 400; guard++) {
      const { game } = get()
      if (game.season.currentDate >= target.date || isSeasonComplete(game)) return
      get().dispatch({ type: 'AdvanceDay' })
    }
  },

  go(screen) {
    set({
      screen,
      inspectedPlayerId: screen === 'player' ? get().inspectedPlayerId : null,
      comparedPlayerId: screen === 'player' ? get().comparedPlayerId : null,
    })
  },

  compare(playerId) {
    set({ comparedPlayerId: playerId })
  },

  inspect(playerId) {
    // Closing the ficha returns you where you opened it from. It always went back
    // to the squad until M4b, which was right while the squad was the only way in
    // — the market screen opens it too, and being dumped somewhere else loses
    // your place in a sixty-row table.
    if (playerId === null) {
      set({ inspectedPlayerId: null, comparedPlayerId: null, screen: get().inspectedFrom })
      return
    }
    const from = get().screen
    set({
      inspectedPlayerId: playerId,
      // Cleared on every open, not only on closing: a comparison belongs to the
      // card you set it on, and carrying it silently onto the next man is how you
      // end up reading the wrong player's numbers. Closing the ficha clears it
      // too, so today every route is covered twice — this is the half that still
      // holds the first time one card links straight to another.
      comparedPlayerId: null,
      screen: 'player',
      inspectedFrom: from === 'player' ? get().inspectedFrom : from,
    })
  },

  async save() {
    // Writes back where this career came from. A career that has never been named
    // keeps going to the unnamed slot, which is exactly what it did before named
    // saves existed — and it stays out of the picker until it is given a name.
    const { currentSlot, game } = get()
    const name = currentSlot === null ? null : nameFor(currentSlot)

    set({ saving: true })
    try {
      await saveGame(
        game,
        rng.state(),
        currentSlot ?? AUTOSAVE_SLOT,
        name === null ? undefined : summaryFor(game, name),
      )
      if (name !== null) await get().refreshSaves()
    } finally {
      set({ saving: false })
    }
  },

  async restore() {
    // Storage being unavailable is not a crash. A private-browsing window, a
    // blocked origin or a test environment with no IndexedDB should all land the
    // player in a fresh season rather than a blank screen.
    //
    // The slot pointer is a *hint*: a save deleted from another tab leaves it
    // dangling, and falling back to the unnamed slot is better than a blank
    // screen. It is also what picks up a career that predates named saves.
    const slot = get().currentSlot
    let loaded
    let fromUnnamed = false
    try {
      loaded = slot === null ? null : await loadGame(slot)
      if (loaded === null) {
        loaded = await loadGame(AUTOSAVE_SLOT)
        fromUnnamed = loaded !== null
      }
      await get().refreshSaves()
    } catch (reason) {
      // Another tab holding an older version of the database is the one failure
      // worth naming. Everything else here degrades to a fresh season, which is
      // right — but a player with a career who is shown the club picker and told
      // nothing will reasonably conclude the career is gone.
      set({ storageBlocked: reason instanceof StorageBlockedError })
      return false
    }

    if (loaded === null) return false
    rng = createRng(loaded.rngState as RngState)
    const game = loaded.payload as GameState
    set({ game, feed: [], needsSetup: false })

    // A career in the unnamed slot is one the picker cannot show, which is how
    // the first player of this feature ended up with a list that stayed empty
    // however often he pressed Save. Give it a name so it is visible, and move
    // it: leaving the unnamed copy behind is a second 165 KB of the same career
    // and a second thing to keep in step.
    if (fromUnnamed) await get().adopt(game)
    return true
  },

  /**
   * Moves a career out of the unnamed slot and into a named one.
   *
   * Silent by design — it is housekeeping, not an action the player took — but
   * its result is not: the save appears in the picker under a default name the
   * player can change by saving under a different one.
   */
  async adopt(game) {
    // `translate` rather than `translatorFor`: `useT.ts` imports this module for
    // its hook, so reaching back for it would close a cycle. `i18n/index.ts`
    // depends on nothing but the three dictionaries.
    const name = translate(get().language, 'saves.adoptedName')
    const slot = slotFor(name)
    try {
      await saveGame(game, rng.state(), slot, summaryFor(game, name))
      await deleteGame(AUTOSAVE_SLOT)
    } catch {
      // The career is loaded and playable; it simply has no row yet. Failing to
      // tidy up is not a reason to refuse to start.
      return
    }
    set({ currentSlot: slot })
    writePreference(SLOT_KEY, slot)
    await get().refreshSaves()
  },

  async refreshSaves() {
    try {
      set({ saves: await listSaves() })
    } catch {
      // Same posture as `restore`: no storage means no saves, not a broken screen.
      set({ saves: [] })
    }
  },

  async saveAs(name) {
    const slot = slotFor(name)
    const { game } = get()

    set({ saving: true })
    try {
      await saveGame(game, rng.state(), slot, summaryFor(game, name.trim()))
      set({ currentSlot: slot })
      writePreference(SLOT_KEY, slot)
      await get().refreshSaves()
    } finally {
      set({ saving: false })
    }
  },

  async load(slot) {
    let loaded
    try {
      loaded = await loadGame(slot)
    } catch {
      return false
    }

    // The row was there a moment ago and its save is not. Refresh rather than
    // report: the honest answer is the list the player is looking at is stale.
    if (loaded === null) {
      await get().refreshSaves()
      return false
    }

    rng = createRng(loaded.rngState as RngState)
    set({
      game: loaded.payload as GameState,
      feed: [],
      screen: 'hub',
      inspectedPlayerId: null,
      comparedPlayerId: null,
      needsSetup: false,
      currentSlot: slot,
    })
    writePreference(SLOT_KEY, slot)
    return true
  },

  async remove(slot) {
    try {
      await deleteGame(slot)
    } catch {
      return
    }

    // Deleting the career you are playing does not end it — the game in memory is
    // untouched. It simply stops having somewhere to go back to, so the pointer
    // has to drop or the next visit follows it to nothing.
    if (get().currentSlot === slot) {
      set({ currentSlot: null })
      writePreference(SLOT_KEY, null)
    }
    await get().refreshSaves()
  },

  newGame(managedClubId) {
    set({
      game: freshGame(managedClubId),
      feed: [],
      screen: 'hub',
      inspectedPlayerId: null,
      comparedPlayerId: null,
      needsSetup: false,
      // A new career has not been saved anywhere yet. Leaving the pointer would
      // make the first Grabar silently overwrite the career you just left.
      currentSlot: null,
    })
    writePreference(SLOT_KEY, null)
  },

  restart() {
    set({
      needsSetup: true,
      screen: 'hub',
      inspectedPlayerId: null,
      comparedPlayerId: null,
      feed: [],
    })
  },

  startNewSeason() {
    get().dispatch({ type: 'StartNewSeason', names: PLAYER_NAMES })
  },
}))
