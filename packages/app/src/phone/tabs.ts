import type { IconName } from '@fm/design-system'
import type { Screen } from '../store.ts'

/**
 * The phone's five places, and the screens each one holds (ADR 0019).
 *
 * Derived from `screen` rather than stored beside it: the store already says
 * where you are, and a second value saying it again is one that can disagree.
 * The order is the order of use — the day, then the team, then the market —
 * and the first screen of each is where its tab lands.
 */
export type Tab = 'today' | 'team' | 'market' | 'league' | 'club'

export const TABS: readonly {
  readonly tab: Tab
  readonly label: string
  readonly icon: IconName
  readonly screens: readonly Screen[]
}[] = [
  { tab: 'today', label: 'tab.today', icon: 'home', screens: ['hub'] },
  { tab: 'team', label: 'tab.team', icon: 'shirt', screens: ['lineup', 'squad'] },
  { tab: 'market', label: 'tab.market', icon: 'transfer', screens: ['market'] },
  { tab: 'league', label: 'tab.league', icon: 'league', screens: ['table', 'results', 'calendar'] },
  { tab: 'club', label: 'tab.club', icon: 'club', screens: ['caja', 'decisiones', 'estadio'] },
]

/**
 * The tab a screen belongs to. A player page belongs to wherever it was opened
 * from, so the bar keeps saying where you are while you look at one.
 */
export function tabOf(screen: Screen, inspectedFrom: Screen): Tab {
  const home = screen === 'player' ? inspectedFrom : screen
  return TABS.find((entry) => entry.screens.includes(home))?.tab ?? 'today'
}
