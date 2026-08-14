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
import { DEFAULT_CLUBS, PLAYER_NAMES } from '@fm/data'
import { loadGame, saveGame } from '@fm/persistence'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './i18n/index.ts'

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
  save(): Promise<void>
  restore(): Promise<boolean>
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

function storedLanguage(): Language {
  try {
    const saved: unknown = globalThis.localStorage?.getItem(LANGUAGE_KEY)
    return isLanguage(saved) ? saved : DEFAULT_LANGUAGE
  } catch {
    // Private browsing, a blocked origin, or a test environment with no storage.
    // A missing preference is a normal state, exactly as a missing save is.
    return DEFAULT_LANGUAGE
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
  feed: [],
  language: storedLanguage(),
  saving: false,
  needsSetup: true,

  dispatch(command) {
    const { state, events } = reduce(get().game, command, rng)
    set({ game: state, feed: [...events, ...get().feed].slice(0, 60) })
    return events
  },

  setLanguage(language) {
    set({ language })
    try {
      globalThis.localStorage?.setItem(LANGUAGE_KEY, language)
    } catch {
      // Unavailable storage costs you the preference next time, not this time.
    }
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
    set({ screen, inspectedPlayerId: screen === 'player' ? get().inspectedPlayerId : null })
  },

  inspect(playerId) {
    // Closing the ficha returns you where you opened it from. It always went back
    // to the squad until M4b, which was right while the squad was the only way in
    // — the market screen opens it too, and being dumped somewhere else loses
    // your place in a sixty-row table.
    if (playerId === null) {
      set({ inspectedPlayerId: null, screen: get().inspectedFrom })
      return
    }
    const from = get().screen
    set({
      inspectedPlayerId: playerId,
      screen: 'player',
      inspectedFrom: from === 'player' ? get().inspectedFrom : from,
    })
  },

  async save() {
    set({ saving: true })
    try {
      await saveGame(get().game, rng.state())
    } finally {
      set({ saving: false })
    }
  },

  async restore() {
    // Storage being unavailable is not a crash. A private-browsing window, a
    // blocked origin or a test environment with no IndexedDB should all land the
    // player in a fresh season rather than a blank screen.
    let loaded
    try {
      loaded = await loadGame()
    } catch {
      return false
    }

    if (loaded === null) return false
    rng = createRng(loaded.rngState as RngState)
    set({ game: loaded.payload as GameState, feed: [], needsSetup: false })
    return true
  },

  newGame(managedClubId) {
    set({
      game: freshGame(managedClubId),
      feed: [],
      screen: 'hub',
      inspectedPlayerId: null,
      needsSetup: false,
    })
  },

  restart() {
    set({ needsSetup: true, screen: 'hub', inspectedPlayerId: null, feed: [] })
  },

  startNewSeason() {
    get().dispatch({ type: 'StartNewSeason', names: PLAYER_NAMES })
  },
}))
