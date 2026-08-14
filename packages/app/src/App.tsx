import { useEffect, useMemo, useState } from 'react'
import { computeTable, formatDate } from '@fm/domain'
import { describeOpponent, matchdayFor } from './matchday.ts'
import { noticesFrom } from './notifications.ts'
import { type Screen, useGame } from './store.ts'
import { BadgeDefs, ClubBadge } from './screens/ClubBadge.tsx'
import { HubScreen } from './screens/HubScreen.tsx'
import { NotificationList } from './screens/NotificationList.tsx'
import { TableScreen } from './screens/TableScreen.tsx'
import { SquadScreen } from './screens/SquadScreen.tsx'
import { PlayerScreen } from './screens/PlayerScreen.tsx'
import { LineupScreen } from './screens/LineupScreen.tsx'
import { MarketScreen } from './screens/MarketScreen.tsx'
import { SetupScreen } from './screens/SetupScreen.tsx'
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
 * The same words as the hub tile that got you here, so what you clicked is what
 * the bar says. This matters more than it sounds now the rail is gone: with no
 * persistent list of sections, the title is the only thing telling you where
 * you are.
 */
const SCREEN_TITLES: Record<Screen, string> = {
  hub: 'Menu Manager',
  table: 'Clasificación',
  squad: 'Plantilla',
  lineup: 'Alineación',
  market: 'Fichar',
  player: 'Ficha',
}

const SCREENS: Record<Screen, () => React.JSX.Element | null> = {
  hub: HubScreen,
  table: TableScreen,
  squad: SquadScreen,
  lineup: LineupScreen,
  market: MarketScreen,
  player: PlayerScreen,
}

export function App() {
  const game = useGame((s) => s.game)
  const screen = useGame((s) => s.screen)
  const restore = useGame((s) => s.restore)
  const needsSetup = useGame((s) => s.needsSetup)
  const feed = useGame((s) => s.feed)
  const unread = useGame((s) => s.unread)
  const markRead = useGame((s) => s.markRead)
  const [newsOpen, setNewsOpen] = useState(false)

  // Pick up an existing career on load. A missing save is a normal state, so
  // failing to find one silently starts the fresh season already in the store.
  useEffect(() => {
    void restore()
  }, [restore])

  const Current = SCREENS[screen]
  const matchday = matchdayFor(game)

  // Where you stand, for the bar. Memoised because the bar re-renders on every
  // tick of the clock and this walks all 380 fixtures; `game` is replaced
  // wholesale by the reducer, so identity is the right dependency.
  const position = useMemo(() => {
    const table = computeTable(game.competition.clubIds, game.season.fixtures)
    return table.findIndex((row) => row.clubId === game.managedClubId) + 1
  }, [game])

  // No career yet: the club picker replaces the whole shell rather than sitting
  // inside it, because none of the navigation means anything before a club exists.
  if (needsSetup) {
    return (
      <div className="shell shell--setup">
        <BadgeDefs />
        <header className="panel shell__bar">
          <h1 className="shell__wordmark">Fútbol Manager</h1>
          <p className="shell__club">
            <span className="shell__date">Primera División · 2026/27</span>
          </p>
        </header>
        <main className="shell__stage">
          <SetupScreen />
        </main>
      </div>
    )
  }

  return (
    <div className="shell">
      <BadgeDefs />
      <header className="panel shell__bar">
        {/* Where you stand, not who you are. The club you manage never changes
            and the hub states it with a crest; what a title bar is for is the
            situation — which competition, which matchday, what position. Left a
            `<p>` deliberately: the heading of the page is the screen you are on,
            and the table screen already owns "Primera División" as a heading. */}
        <p className="shell__where">
          <span className="shell__competition">{game.competition.name}</span>
          {/* No next fixture means the season is done, so there is no matchday
              to be on — better absent than pinned at 38. */}
          {matchday !== null && (
            <span className="shell__matchday">Jornada {matchday.fixture.round}</span>
          )}
          {position > 0 && <span className="shell__position">{position}º</span>}
        </p>
        <h1 className="shell__title">{SCREEN_TITLES[screen]}</h1>
        <p className="shell__club">
          <span className="shell__date">{formatDate(game.season.currentDate)}</span>
          {/* Always visible, because sleepwalking past your own fixture was the
              whole complaint — and the controls that act on it now live on the
              hub, so this is what tells you to go back there. */}
          {matchday !== null && (
            <span className={`shell__next${matchday.due ? ' is-due' : ''}`}>
              Next {matchday.opponent !== undefined && <ClubBadge club={matchday.opponent} />}{' '}
              {describeOpponent(matchday)} · {matchday.due ? 'today' : `in ${matchday.daysAway}d`}
            </span>
          )}
          <button
            type="button"
            className="button shell__news"
            onClick={() => {
              setNewsOpen(!newsOpen)
              markRead()
            }}
          >
            Noticias{unread > 0 && <span className="shell__badge">{unread}</span>}
          </button>
        </p>
      </header>

      {newsOpen && (
        <aside className="screen shell__drawer" aria-label="Noticias">
          <h2 className="screen__heading">Noticias</h2>
          <NotificationList notices={noticesFrom(feed, game)} empty="Nothing has happened yet." />
          <div className="shell__drawer-foot">
            <button type="button" className="button" onClick={() => setNewsOpen(false)}>
              Close
            </button>
          </div>
        </aside>
      )}

      <main className="shell__stage">
        <Current />
      </main>
    </div>
  )
}
