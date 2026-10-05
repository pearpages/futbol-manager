import { useEffect } from 'react'
import { LOCALE_TAGS } from './i18n/format.ts'
import { useT } from './i18n/useT.ts'
import { type Screen as ScreenKey, useGame } from './store.ts'
import { BadgeDefs, Panel } from '@fm/design-system'
import { HubScreen } from './screens/HubScreen.tsx'
import { SettingsMenu } from './screens/SettingsMenu.tsx'
import { ShellCredit } from './screens/ShellCredit.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { CalendarScreen } from './screens/CalendarScreen.tsx'
import { TableScreen } from './screens/TableScreen.tsx'
import { SquadScreen } from './screens/SquadScreen.tsx'
import { PlayerScreen } from './screens/PlayerScreen.tsx'
import { LineupScreen } from './screens/LineupScreen.tsx'
import { MarketScreen } from './screens/MarketScreen.tsx'
import { LandingScreen } from './screens/LandingScreen.tsx'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { CajaScreen } from './screens/CajaScreen.tsx'
import { DecisionesScreen } from './screens/DecisionesScreen.tsx'
import { EstadioScreen } from './screens/EstadioScreen.tsx'
import { Shell } from './shell/Shell.tsx'
import './App.css'

/**
 * The shell: a hardware frame around an inset screen.
 *
 * Navigation is a value in the store rather than a router. This is a game, not a
 * site — there are no URLs to share and no back button to honour — so a router
 * would be a dependency bought for nothing.
 */

const SCREENS: Record<ScreenKey, () => React.JSX.Element | null> = {
  hub: HubScreen,
  table: TableScreen,
  results: ResultsScreen,
  calendar: CalendarScreen,
  squad: SquadScreen,
  lineup: LineupScreen,
  market: MarketScreen,
  player: PlayerScreen,
  caja: CajaScreen,
  decisiones: DecisionesScreen,
  estadio: EstadioScreen,
}

export function App() {
  const game = useGame((s) => s.game)
  const screen = useGame((s) => s.screen)
  const restore = useGame((s) => s.restore)
  const needsSetup = useGame((s) => s.needsSetup)
  const entry = useGame((s) => s.entry)
  const translator = useT()
  const { t, season, language } = translator

  // Pick up an existing career on load. A missing save is a normal state, so
  // failing to find one silently starts the fresh season already in the store.
  useEffect(() => {
    void restore()
  }, [restore])

  // `index.html` ships `lang="en"`, which is a lie in two languages out of three
  // and the first thing assistive technology reads.
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAGS[language]
  }, [language])

  const Current = SCREENS[screen]

  // The front door, and the first thing anyone sees. Ahead of the club picker
  // because it is what sends you there — and shown whether or not a career
  // exists, since Continue is one of the ways through it.
  //
  // No title bar on this branch: the cover carries the game's name, and a second
  // copy in a bar is the duplicate-navigation mistake this shell has shed twice.
  // `restore()` above still runs, which is what lights Continue up.
  if (entry === 'landing') {
    return (
      <div className="shell shell--landing">
        <main className="shell__stage">
          <LandingScreen />
        </main>
        <ShellCredit />
      </div>
    )
  }

  // No career yet: the club picker replaces the whole shell rather than sitting
  // inside it, because none of the navigation means anything before a club exists.
  if (needsSetup) {
    return (
      <div className="shell shell--setup">
        <BadgeDefs />
        <Panel as="header" className="shell__bar">
          <h1 className="shell__wordmark">{t('shell.wordmark')}</h1>
          <p className="shell__club">
            <span className="shell__date">
              {game.competition.name} · {season(game.season.startYear)}
            </span>
            <SettingsMenu />
          </p>
        </Panel>
        <main className="shell__stage">
          <SetupScreen />
        </main>
        <ShellCredit />
      </div>
    )
  }

  // One shell at every width (ADR 0022): the desk is the phone with more room.
  return (
    <Shell>
      <Current />
    </Shell>
  )
}
