import { useEffect } from 'react'
import { formatDate, isSeasonComplete } from '@fm/domain'
import { type Screen, useGame } from './store.ts'
import { TableScreen } from './screens/TableScreen.tsx'
import { SquadScreen } from './screens/SquadScreen.tsx'
import { PlayerScreen } from './screens/PlayerScreen.tsx'
import { LineupScreen } from './screens/LineupScreen.tsx'
import './App.css'

/**
 * The shell: a hardware frame around an inset screen.
 *
 * Navigation is a value in the store rather than a router. This is a game, not a
 * site — there are no URLs to share and no back button to honour — so a router
 * would be a dependency bought for nothing.
 */

const NAV: readonly { screen: Screen; label: string }[] = [
  { screen: 'table', label: 'Table' },
  { screen: 'squad', label: 'Squad' },
  { screen: 'lineup', label: 'Lineup' },
]

const SCREENS: Record<Screen, () => React.JSX.Element | null> = {
  table: TableScreen,
  squad: SquadScreen,
  lineup: LineupScreen,
  player: PlayerScreen,
}

export function App() {
  const game = useGame((s) => s.game)
  const screen = useGame((s) => s.screen)
  const go = useGame((s) => s.go)
  const dispatch = useGame((s) => s.dispatch)
  const save = useGame((s) => s.save)
  const restore = useGame((s) => s.restore)
  const saving = useGame((s) => s.saving)

  // Pick up an existing career on load. A missing save is a normal state, so
  // failing to find one silently starts the fresh season already in the store.
  useEffect(() => {
    void restore()
  }, [restore])

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const finished = isSeasonComplete(game)
  const Current = SCREENS[screen]

  return (
    <div className="shell">
      <header className="panel shell__bar">
        <h1 className="shell__wordmark">Fútbol Manager</h1>
        <p className="shell__club">
          <span className="shell__club-name">{club?.name ?? '—'}</span>
          <span className="shell__date">{formatDate(game.season.currentDate)}</span>
        </p>
      </header>

      <nav className="panel shell__nav" aria-label="Sections">
        {NAV.map((item) => (
          <button
            key={item.screen}
            type="button"
            className={`button shell__nav-item${screen === item.screen ? ' is-primary' : ''}`}
            aria-current={screen === item.screen ? 'page' : undefined}
            onClick={() => go(item.screen)}
          >
            {item.label}
          </button>
        ))}

        <div className="shell__actions">
          <button
            type="button"
            className="button is-primary shell__advance"
            disabled={finished}
            onClick={() => dispatch({ type: 'AdvanceDay' })}
          >
            {finished ? 'Season over' : 'Advance day'}
          </button>
          <button type="button" className="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </nav>

      <main className="shell__stage">
        <Current />
      </main>
    </div>
  )
}
