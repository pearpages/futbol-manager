import { useEffect } from 'react'
import { formatDate, formatMoney, isSeasonComplete } from '@fm/domain'
import { describeOpponent, matchdayFor, weakLineup } from '../matchday.ts'
import { noticesFrom } from '../notifications.ts'
import { type Screen, useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { NotificationList } from './NotificationList.tsx'
import { type IconKey, TileIcon } from './TileIcon.tsx'
import './HubScreen.css'

/**
 * The manager's home.
 *
 * PC Fútbol 5.0 navigated from a hub rather than a menu bar — four labelled
 * quadrants around a centre carrying who you are and when it is. That structure
 * is worth taking: it groups screens by the *question being asked* rather than
 * listing them, and it leaves an obvious place for the two things that were
 * missing entirely — what has happened, and when you next play.
 *
 * The rail stays alongside it, so nothing here is the only way anywhere.
 *
 * **Unbuilt sections are shown, disabled, with the milestone that brings them.**
 * An empty quadrant would look broken; a labelled one says the shape of the
 * finished game out loud and turns the hub into a roadmap you can see. Only
 * milestones the roadmap actually assigns are named — Calendario has none, so it
 * promises nothing.
 */

interface Tile {
  readonly label: string
  /** Where it goes, or `null` when it is not built yet. */
  readonly to: Screen | null
  /** Shown on a disabled tile. Omitted when nothing has been scheduled. */
  readonly milestone?: string
  readonly icon: IconKey
}

/**
 * Names the section for the CSS, which uses it for **both** the colour and the
 * grid placement. Placement used to key on `:nth-of-type`, which tied a
 * quadrant's position to its position in this array — reorder the list and the
 * screen silently rearranged.
 */
export type QuadrantKey = 'seguimiento' | 'entrenador' | 'mercado' | 'finanzas'

interface Quadrant {
  readonly key: QuadrantKey
  readonly title: string
  readonly tiles: readonly Tile[]
}

/**
 * Two tiles landing on one screen is deliberate and matches the reference:
 * "where am I in the league" and "what happened at the weekend" are different
 * questions, even though one screen currently answers both.
 */
export const QUADRANTS: readonly Quadrant[] = [
  {
    key: 'seguimiento',
    title: 'Seguimiento',
    tiles: [
      { label: 'Clasificación', to: 'table', icon: 'table' },
      { label: 'Resultados', to: 'table', icon: 'results' },
      { label: 'Calendario', to: null, icon: 'calendar' },
    ],
  },
  {
    key: 'entrenador',
    title: 'Entrenador',
    tiles: [
      { label: 'Alineación', to: 'lineup', icon: 'pitch' },
      { label: 'Tácticas', to: 'lineup', icon: 'tactics' },
      { label: 'Ver rival', to: null, milestone: 'M7', icon: 'scout' },
    ],
  },
  {
    key: 'mercado',
    title: 'Mercado',
    tiles: [
      { label: 'Fichar', to: 'market', icon: 'contract' },
      { label: 'Plantilla', to: 'squad', icon: 'roster' },
      { label: 'Cantera', to: null, milestone: 'M7', icon: 'youth' },
    ],
  },
  {
    key: 'finanzas',
    title: 'Finanzas',
    tiles: [
      { label: 'Caja', to: 'caja', icon: 'safe' },
      { label: 'Decisiones', to: 'decisiones', icon: 'scales' },
      { label: 'Estadio', to: 'estadio', icon: 'stadium' },
    ],
  },
]

export function HubScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const go = useGame((s) => s.go)
  const markRead = useGame((s) => s.markRead)
  const dispatch = useGame((s) => s.dispatch)
  const advanceToMatchday = useGame((s) => s.advanceToMatchday)
  const startNewSeason = useGame((s) => s.startNewSeason)
  const save = useGame((s) => s.save)
  const saving = useGame((s) => s.saving)
  const restart = useGame((s) => s.restart)

  // Landing on the hub *is* reading the news — the panel is right there. Anything
  // subtler would leave a badge lit above a list you are already looking at.
  useEffect(() => {
    markRead()
  }, [markRead, feed])

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const matchday = matchdayFor(game)
  const weak = weakLineup(game)
  const finished = isSeasonComplete(game)
  const nextYearLabel = String(game.season.startYear + 2).slice(2)
  const notices = noticesFrom(feed, game).slice(0, 12)

  return (
    <div className="hub">
      {/* `data-quadrant` carries the section's identity to the CSS, which uses it
          for the colour and for where the panel sits. The element stays a
          `<section>` with the title as its heading: that pair is how the tests —
          and a screen reader — find a quadrant. */}
      {QUADRANTS.map((quadrant) => (
        <section key={quadrant.key} className="screen hub__quadrant" data-quadrant={quadrant.key}>
          <h2 className="screen__heading">{quadrant.title}</h2>
          <div className="hub__tiles">
            {quadrant.tiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                className="button hub__tile"
                disabled={tile.to === null}
                title={
                  tile.to === null
                    ? tile.milestone === undefined
                      ? 'Not built yet'
                      : `Arrives at ${tile.milestone}`
                    : undefined
                }
                onClick={() => tile.to !== null && go(tile.to)}
              >
                <TileIcon icon={tile.icon} />
                <span className="hub__tile-label">{tile.label}</span>
                {tile.milestone !== undefined && (
                  <span className="hub__tile-milestone">{tile.milestone}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      <aside className="hub__centre">
        <section className="screen hub__identity">
          <h2 className="screen__heading hub__crest">
            {club !== undefined && <ClubBadge club={club} size="lg" labelled />}
            {club?.name ?? '—'}
          </h2>
          <div className="hub__vitals">
            <div className="stat">
              <span className="stat__label">Date</span>
              <span className="stat__value hub__date">{formatDate(game.season.currentDate)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Budget</span>
              <span className="stat__value hub__date">{formatMoney(club?.budget ?? 0)}</span>
            </div>
          </div>
        </section>

        <section className="screen hub__next">
          <h2 className="screen__heading">Next match</h2>
          {game.board.sacked ? (
            <p className="hub__warning" role="status">
              The board have dismissed you. They wanted {game.board.target}º and did not get it
              twice running.
            </p>
          ) : matchday === null ? (
            <p className="screen__note">The season is over.</p>
          ) : (
            <div className="hub__next-body">
              {/* The badge belongs beside the name, not instead of it — a crest
                  says *which* club faster than three letters do, and the name
                  still has to be readable to a first-time player. */}
              <p className="hub__opponent">
                {matchday.opponent !== undefined && (
                  <ClubBadge club={matchday.opponent} size="lg" />
                )}
                {describeOpponent(matchday)}
              </p>
              <p className={`hub__when${matchday.due ? ' is-due' : ''}`}>
                {matchday.due
                  ? 'Today'
                  : `in ${matchday.daysAway} day${matchday.daysAway === 1 ? '' : 's'}`}
              </p>
              {weak !== null && (
                <p className="hub__warning" role="status">
                  Your XI is not your strongest — {weak.current} against {weak.best}. Signing
                  someone does not pick him.
                </p>
              )}
            </div>
          )}

          {/*
            The clock lives here and nowhere else, which is the point: every tick
            routes you past the news and the fixture above it. Three states, in
            priority order — the season ending is the door to the summer; a
            fixture being due makes kicking off a deliberate press rather than a
            side effect of advancing a day; otherwise the clock just runs.
          */}
          <div className="screen-actions hub__controls">
            {game.board.sacked ? (
              // The end of the job, and the end of the career. There is no path
              // on from here — the only button left is a new one somewhere else.
              <button type="button" className="button is-primary" onClick={restart}>
                Nueva carrera
              </button>
            ) : finished ? (
              <button type="button" className="button is-primary" onClick={() => startNewSeason()}>
                {`Start ${game.season.startYear + 1}/${nextYearLabel}`}
              </button>
            ) : matchday !== null && matchday.due ? (
              <button
                type="button"
                className="button is-primary hub__play"
                onClick={() => dispatch({ type: 'AdvanceDay' })}
              >
                {`Play match ${describeOpponent(matchday)}`}
              </button>
            ) : (
              <>
                {matchday !== null && (
                  <button type="button" className="button" onClick={advanceToMatchday}>
                    To matchday
                  </button>
                )}
                <button
                  type="button"
                  className="button is-primary"
                  onClick={() => dispatch({ type: 'AdvanceDay' })}
                >
                  Advance day
                </button>
              </>
            )}
          </div>
        </section>

        <section className="screen hub__news">
          <h2 className="screen__heading">Noticias</h2>
          <NotificationList notices={notices} empty="Nothing has happened yet." />
        </section>

        {/* Grabar la liga and leaving were hub buttons in the original too. */}
        <div className="panel hub__utilities">
          <button type="button" className="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Grabar'}
          </button>
          <button type="button" className="button" onClick={restart}>
            Nueva carrera
          </button>
        </div>
      </aside>
    </div>
  )
}
