import { create } from 'zustand'
import {
  type Command,
  createRng,
  type Event,
  type GameState,
  newSeason,
  reduce,
  type Rng,
  type RngState,
} from '@fm/domain'
import { DEFAULT_CLUBS, PLAYER_NAMES } from '@fm/data'
import { loadGame, saveGame } from '@fm/persistence'

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

export type Screen = 'table' | 'squad' | 'lineup' | 'market' | 'player'

interface Store {
  readonly game: GameState
  readonly screen: Screen
  /** Set when a screen opens a ficha; cleared on navigation. */
  readonly inspectedPlayerId: string | null
  /** Which screen the ficha was opened from, so closing it goes back there. */
  readonly inspectedFrom: Screen
  /** Most recent events, newest first — the match feed on the table screen. */
  readonly feed: readonly Event[]
  readonly saving: boolean
  /**
   * True until a club has been chosen or a save restored. Distinguishes "no
   * career yet" from "career loaded" — without it the app cannot tell whether the
   * state it holds is a real game or the placeholder season built at module load.
   */
  readonly needsSetup: boolean

  dispatch(command: Command): void
  go(screen: Screen): void
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
  screen: 'table',
  inspectedPlayerId: null,
  inspectedFrom: 'squad',
  feed: [],
  saving: false,
  needsSetup: true,

  dispatch(command) {
    const { state, events } = reduce(get().game, command, rng)
    set({ game: state, feed: [...events, ...get().feed].slice(0, 60) })
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
      screen: 'table',
      inspectedPlayerId: null,
      needsSetup: false,
    })
  },

  restart() {
    set({ needsSetup: true, screen: 'table', inspectedPlayerId: null, feed: [] })
  },

  startNewSeason() {
    get().dispatch({ type: 'StartNewSeason', names: PLAYER_NAMES })
  },
}))
