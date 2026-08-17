import { useEffect } from 'react'
import { transferWindowDaysLeft } from '@fm/domain'
import { LOCALE_TAGS } from './i18n/format.ts'
import { useT } from './i18n/useT.ts'
import { matchdayFor } from './matchday.ts'
import { type Screen, useGame } from './store.ts'
import { BadgeDefs } from './screens/ClubBadge.tsx'
import { HubScreen } from './screens/HubScreen.tsx'
import { SettingsMenu } from './screens/SettingsMenu.tsx'
import { ShellCredit } from './screens/ShellCredit.tsx'
import { ShellFoot } from './screens/ShellFoot.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { TableScreen } from './screens/TableScreen.tsx'
import { SquadScreen } from './screens/SquadScreen.tsx'
import { PlayerScreen } from './screens/PlayerScreen.tsx'
import { LineupScreen } from './screens/LineupScreen.tsx'
import { MarketScreen } from './screens/MarketScreen.tsx'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { CajaScreen } from './screens/CajaScreen.tsx'
import { DecisionesScreen } from './screens/DecisionesScreen.tsx'
import { EstadioScreen } from './screens/EstadioScreen.tsx'
import './App.css'

/**
 * The shell: a hardware frame around an inset screen.
 *
 * Navigation is a value in the store rather than a router. This is a game, not a
 * site — there are no URLs to share and no back button to honour — so a router
 * would be a dependency bought for nothing.
 */

/**
 * What the bar calls the screen you are on.
 *
 * **The same key the hub tile uses**, not the same string typed twice. The two
 * were separate literals in separate files, which is how "the bar says what you
 * clicked" quietly stops being true — and with three languages it would have
 * stopped being true three times over.
 */
const SCREEN_TITLES: Record<Screen, string> = {
  hub: 'nav.hub',
  table: 'nav.table',
  results: 'nav.results',
  squad: 'nav.squad',
  lineup: 'nav.lineup',
  market: 'nav.market',
  player: 'nav.player',
  caja: 'nav.caja',
  decisiones: 'nav.decisiones',
  estadio: 'nav.estadio',
}

const SCREENS: Record<Screen, () => React.JSX.Element | null> = {
  hub: HubScreen,
  table: TableScreen,
  results: ResultsScreen,
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
  const translator = useT()
  const { t, plural, season, language } = translator

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
  const matchday = matchdayFor(game)

  // Null *is* the closed state, so this answers "is it open" and "for how long" in
  // one call rather than asking the predicate and then the count.
  const windowDaysLeft = transferWindowDaysLeft(game.season.currentDate)

  // No career yet: the club picker replaces the whole shell rather than sitting
  // inside it, because none of the navigation means anything before a club exists.
  if (needsSetup) {
    return (
      <div className="shell shell--setup">
        <BadgeDefs />
        <header className="panel shell__bar">
          <h1 className="shell__wordmark">{t('shell.wordmark')}</h1>
          <p className="shell__club">
            <span className="shell__date">
              {game.competition.name} · {season(game.season.startYear)}
            </span>
            <SettingsMenu />
          </p>
        </header>
        <main className="shell__stage">
          <SetupScreen />
        </main>
        <ShellCredit />
      </div>
    )
  }

  return (
    <div className="shell">
      <BadgeDefs />
      <header className="panel shell__bar">
        {/* When you are, not who you are. The club you manage never changes and the
            hub states it with a crest; what a title bar is for is the situation —
            which competition and which matchday. Position used to sit here too and
            now lives on the hub, where it is looked at rather than passed. Left a
            `<p>` deliberately: the heading of the page is the screen you are on,
            and the table screen already owns the competition name as a heading. */}
        <p className="shell__where">
          <span className="shell__competition">{game.competition.name}</span>
          {/* No next fixture means the season is done, so there is no matchday
              to be on — better absent than pinned at 38. */}
          {matchday !== null && (
            <span className="shell__matchday">
              {t('shell.matchday', { round: matchday.fixture.round })}
            </span>
          )}
        </p>
        <h1 className="shell__title">{t(SCREEN_TITLES[screen])}</h1>
        <p className="shell__club">
          {/* The date and the next fixture used to sit here and were a weaker copy
              of what the hub already shows — and the hub is the only place the day
              can be advanced, so you pass the real ones every tick.

              What the game never announced is the one deadline it enforces. Shown
              only while the window is open — a badge that is always there is
              furniture — and carrying the days left, because "you may buy" without
              "until when" is half a deadline. */}
          {windowDaysLeft !== null && (
            <span className="shell__window">{plural('shell.windowOpen', windowDaysLeft)}</span>
          )}
          <SettingsMenu />
        </p>
      </header>

      <main className="shell__stage">
        <Current />
      </main>

      {/* Every screen's way out, and everything you do to the game rather than
          inside it. Owned by the shell so it is in the same two corners on every
          screen — it used to be eight separate buttons in three different
          places, one of them at the top. */}
      <ShellFoot />

      {/* Below the hardware rather than on it — the plate on the underside of the
          machine, not a control. Carried by both branches of the shell. */}
      <ShellCredit />
    </div>
  )
}
