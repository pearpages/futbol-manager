import { useMemo, useState } from 'react'
import { type ClubId, computeTable, isSeasonComplete, recentResultsFor } from '@fm/domain'
import { bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { describeOpponent, matchdayFor, weakLineup } from '../matchday.ts'
import { noticesFrom } from '../notifications.ts'
import { type Screen, useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { FORM_MATCHES, FormStrip } from './FormStrip.tsx'
import { HubFigure } from './HubFigure.tsx'
import { Modal } from './Modal.tsx'
import { NotificationList } from './NotificationList.tsx'
import { SaveManagerModal } from './SaveManagerModal.tsx'
import { type FigureKey } from './sprites.ts'
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
  /**
   * Names the destination for the dictionary *and* for the tests.
   *
   * It was a Spanish literal, typed again in `App.tsx`'s title map — so the two
   * could drift, and every test clicked a tile by a word that only exists in one
   * language. The key is the stable thing; the label is a rendering of it.
   */
  readonly key: string
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
  /** Dictionary key, not a word. */
  readonly title: string
  readonly tiles: readonly Tile[]
  /**
   * The person who stands at the foot of the section.
   *
   * Decoration, and the reference's other half: PC Fútbol drew every quadrant as
   * an illustrated vignette, and two of its four carried human figures. Named
   * here rather than derived from `key` so a section and its figure stay
   * separable — the same reason a tile names its icon.
   */
  readonly figure: FigureKey
}

/**
 * Two tiles landing on one screen is deliberate and matches the reference:
 * "where am I in the league" and "what happened at the weekend" are different
 * questions, even though one screen currently answers both.
 */
export const QUADRANTS: readonly Quadrant[] = [
  {
    key: 'seguimiento',
    title: 'quadrant.seguimiento',
    tiles: [
      { key: 'nav.table', to: 'table', icon: 'table' },
      { key: 'nav.results', to: 'table', icon: 'results' },
      { key: 'nav.calendar', to: null, icon: 'calendar' },
    ],
    figure: 'assistant',
  },
  {
    key: 'entrenador',
    title: 'quadrant.entrenador',
    tiles: [
      { key: 'nav.lineup', to: 'lineup', icon: 'pitch' },
      { key: 'nav.tactics', to: 'lineup', icon: 'tactics' },
      { key: 'nav.scout', to: null, milestone: 'M7', icon: 'scout' },
    ],
    figure: 'trainer',
  },
  {
    key: 'mercado',
    title: 'quadrant.mercado',
    tiles: [
      { key: 'nav.market', to: 'market', icon: 'contract' },
      { key: 'nav.squad', to: 'squad', icon: 'roster' },
      { key: 'nav.youth', to: null, milestone: 'M7', icon: 'youth' },
    ],
    figure: 'agent',
  },
  {
    key: 'finanzas',
    title: 'quadrant.finanzas',
    tiles: [
      { key: 'nav.caja', to: 'caja', icon: 'safe' },
      { key: 'nav.decisiones', to: 'decisiones', icon: 'scales' },
      { key: 'nav.estadio', to: 'estadio', icon: 'stadium' },
    ],
    figure: 'director',
  },
]

export function HubScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const go = useGame((s) => s.go)
  const dispatch = useGame((s) => s.dispatch)
  const advanceToMatchday = useGame((s) => s.advanceToMatchday)
  const startNewSeason = useGame((s) => s.startNewSeason)
  const saving = useGame((s) => s.saving)
  const restart = useGame((s) => s.restart)
  const translator = useT()
  const { t, plural, date, money, season } = translator

  // Both dialogs are the hub's own business: the picker is opened from here, and
  // leaving for the club picker is a press made here. Neither is store state —
  // an open dialog belongs to this sitting more narrowly than `screen` does.
  const [saveManager, setSaveManager] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const matchday = matchdayFor(game)
  const form = recentResultsFor(game.season.fixtures, game.managedClubId, FORM_MATCHES)
  const clubName = (id: ClubId) => game.clubs.find((c) => c.id === id)?.name ?? '???'

  // Where you stand. Memoised because the hub re-renders on every tick of the clock
  // and this walks all 380 fixtures; the reducer replaces `game` wholesale, so identity
  // is the right dependency. The table is kept, not just the index — `bandFor` needs
  // the league size to know where the relegation zone starts.
  const standing = useMemo(() => {
    const table = computeTable(game.competition.clubIds, game.season.fixtures)
    return {
      position: table.findIndex((row) => row.clubId === game.managedClubId) + 1,
      total: table.length,
    }
  }, [game])
  const band = bandFor(standing.position, standing.total)
  const weak = weakLineup(game)
  const finished = isSeasonComplete(game)
  const notices = noticesFrom(feed, game, translator).slice(0, 12)

  return (
    <div className="hub">
      {/* `data-quadrant` carries the section's identity to the CSS, which uses it
          for the colour and for where the panel sits. The element stays a
          `<section>` with the title as its heading: that pair is how the tests —
          and a screen reader — find a quadrant. */}
      {QUADRANTS.map((quadrant) => (
        <section key={quadrant.key} className="screen hub__quadrant" data-quadrant={quadrant.key}>
          <h2 className="screen__heading">{t(quadrant.title)}</h2>
          <div className="hub__tiles">
            {quadrant.tiles.map((tile) => (
              <button
                key={tile.key}
                type="button"
                className="button hub__tile"
                disabled={tile.to === null}
                title={
                  tile.to === null
                    ? tile.milestone === undefined
                      ? t('hub.notBuilt')
                      : t('hub.arrivesAt', { milestone: tile.milestone })
                    : undefined
                }
                onClick={() => tile.to !== null && go(tile.to)}
              >
                <TileIcon icon={tile.icon} />
                <span className="hub__tile-label">{t(tile.key)}</span>
                {tile.milestone !== undefined && (
                  <span className="hub__tile-milestone">{tile.milestone}</span>
                )}
              </button>
            ))}
          </div>
          <HubFigure figure={quadrant.figure} />
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
              <span className="stat__label">{t('hub.date')}</span>
              <span className="stat__value hub__date">{date(game.season.currentDate)}</span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('hub.position')}</span>
              {/* Colour is never the only signal — the band's name is on the element
                  and available to a screen reader, exactly as the table's rows do it. */}
              <span
                className={`stat__value hub__position ${band?.className ?? ''}`}
                title={band === null ? undefined : t(band.label)}
              >
                {standing.position > 0 ? standing.position : '—'}
                {/* The leading space is load-bearing: without it the accessible name
                    runs together as "20Relegated", the same wart a disabled hub tile
                    has with its milestone badge. */}
                {band !== null && <span className="visually-hidden"> {t(band.label)}</span>}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">{t('hub.budget')}</span>
              <span className="stat__value hub__date">{money(club?.budget ?? 0)}</span>
            </div>
          </div>
          {/* How the team is actually going, which the hub said nothing about — the
              classification answered it in a table you had to go and read. Derived
              from the fixtures rather than the news feed: the feed is session-only
              and capped, so a strip built on it would blank after a reload. */}
          <FormStrip results={form} names={clubName} translator={translator} />
        </section>

        <section className="screen hub__next">
          <h2 className="screen__heading">{t('hub.nextMatch')}</h2>
          {game.board.sacked ? (
            <p className="hub__warning" role="status">
              {t('hub.dismissed', { target: game.board.target })}
            </p>
          ) : matchday === null ? (
            <p className="screen__note">{t('hub.seasonOver')}</p>
          ) : (
            <div className="hub__next-body">
              {/* The badge belongs beside the name, not instead of it — a crest
                  says *which* club faster than three letters do, and the name
                  still has to be readable to a first-time player. */}
              <p className="hub__opponent">
                {matchday.opponent !== undefined && (
                  <ClubBadge club={matchday.opponent} size="lg" />
                )}
                {describeOpponent(translator, matchday)}
              </p>
              <p className={`hub__when${matchday.due ? ' is-due' : ''}`}>
                {matchday.due ? t('hub.today') : plural('hub.inDays', matchday.daysAway)}
              </p>
              {weak !== null && (
                <p className="hub__warning" role="status">
                  {t('hub.weakLineup', { current: weak.current, best: weak.best })}
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
                {t('action.newCareer')}
              </button>
            ) : finished ? (
              <button type="button" className="button is-primary" onClick={() => startNewSeason()}>
                {t('hub.startSeason', { season: season(game.season.startYear + 1) })}
              </button>
            ) : matchday !== null && matchday.due ? (
              <button
                type="button"
                className="button is-primary hub__play"
                onClick={() => dispatch({ type: 'AdvanceDay' })}
              >
                {t('hub.playMatch', { opponent: describeOpponent(translator, matchday) })}
              </button>
            ) : (
              <>
                {matchday !== null && (
                  <button type="button" className="button" onClick={advanceToMatchday}>
                    {t('hub.toMatchday')}
                  </button>
                )}
                <button
                  type="button"
                  className="button is-primary"
                  onClick={() => dispatch({ type: 'AdvanceDay' })}
                >
                  {t('hub.advanceDay')}
                </button>
              </>
            )}
          </div>
        </section>

        <section className="screen hub__news">
          <h2 className="screen__heading">{t('hub.news')}</h2>
          <NotificationList notices={notices} empty={t('hub.noNews')} />
        </section>

        {/* Grabar la liga and leaving were hub buttons in the original too.
            Grabar opens the dialog rather than writing silently. It used to be a
            quick save with naming behind a second button, and the first person to
            use it could neither name a game nor find one to load: a button that
            produces no visible result is indistinguishable from a broken one. */}
        <div className="panel hub__utilities">
          <button
            type="button"
            className="button"
            disabled={saving}
            onClick={() => {
              setSaveManager(true)
            }}
          >
            {saving ? t('action.saving') : t('action.save')}
          </button>
          {/* Asked before, not after: this used to drop the career on the first
              press, and there is no undo behind it. */}
          <button
            type="button"
            className="button"
            onClick={() => {
              setLeaving(true)
            }}
          >
            {t('action.newCareer')}
          </button>
        </div>
      </aside>

      {saveManager && (
        <SaveManagerModal
          onClose={() => {
            setSaveManager(false)
          }}
        />
      )}

      {leaving && (
        <Modal
          title={t('action.newCareer')}
          onClose={() => {
            setLeaving(false)
          }}
        >
          <p className="hub__question">{t('hub.confirmNewCareer')}</p>
          <div className="screen-actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                setLeaving(false)
              }}
            >
              {t('action.cancel')}
            </button>
            <button type="button" className="button is-primary" onClick={restart}>
              {t('action.newCareer')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
