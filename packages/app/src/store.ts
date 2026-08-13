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

export type Screen = 'table' | 'squad' | 'lineup' | 'player'

interface Store {
  readonly game: GameState
  readonly screen: Screen
  /** Set when the squad screen opens a ficha; cleared on navigation. */
  readonly inspectedPlayerId: string | null
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
    set({ inspectedPlayerId: playerId, screen: playerId === null ? 'squad' : 'player' })
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
}))
