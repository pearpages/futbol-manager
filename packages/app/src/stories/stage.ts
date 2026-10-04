import type { Language } from '../i18n/index.ts'
import { type MarketTab, type Screen, useGame } from '../store.ts'

/**
 * Puts the game into a known state for a story.
 *
 * Every scene starts the same career from the store's fixed seed and plays it
 * forward a set number of days through the reducer, exactly as a player would,
 * so a story shows real data and shows the same data every time.
 */
export interface Scene {
  /** Where to land. `landing` and `setup` are the two screens outside the shell. */
  readonly screen: Screen | 'landing' | 'setup'
  /** Days to play before looking. 0 is the morning of the first matchday. */
  readonly days?: number
  /** The club to manage. Madrid by default. */
  readonly club?: string
  readonly marketTab?: MarketTab
}

export function stage(scene: Scene, language: Language): void {
  const store = useGame.getState()
  store.newGame(scene.club ?? 'madrid')
  for (let day = 0; day < (scene.days ?? 0); day++) store.dispatch({ type: 'AdvanceDay' })

  useGame.setState({
    language,
    // A story must show its scene, never a career Storybook's own storage
    // happens to hold from an earlier click on Desada ràpida.
    restore: () => Promise.resolve(false),
    marketTab: scene.marketTab ?? 'forSale',
    ...(scene.screen === 'landing'
      ? { entry: 'landing' }
      : scene.screen === 'setup'
        ? { entry: 'app', needsSetup: true }
        : { entry: 'app', needsSetup: false, screen: scene.screen }),
  })

  if (scene.screen === 'player') {
    const { game } = useGame.getState()
    const first = game.lineups[game.managedClubId]?.starters[0]
    useGame.setState({ screen: 'squad' })
    if (first !== undefined) useGame.getState().inspect(first)
  }
}
