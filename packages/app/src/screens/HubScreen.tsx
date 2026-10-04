import { useMemo, useState } from 'react'
import { type ClubId, computeTable, isSeasonComplete, recentResultsFor } from '@fm/domain'
import { bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { describeOpponent, matchdayFor, weakLineup } from '../matchday.ts'
import { noticesFrom } from '../notifications.ts'
import { type Screen as ScreenKey, useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { FORM_MATCHES, FormStrip } from './FormStrip.tsx'
import {
  Button,
  HubFigure,
  type IconKey,
  Modal,
  Screen,
  ScreenActions,
  ScreenHeading,
  ScreenNote,
  Stat,
  StatLabel,
  StatValue,
  TileIcon,
  VisuallyHidden,
} from '@fm/design-system'
import { artSrc, type FigureKey } from './art.ts'
import { NotificationList } from './NotificationList.tsx'
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
 * finished game out loud and turns the hub into a roadmap you can see. That is now
 * enforced by the `Tile` type rather than left to care — see below.
 */

/**
 * Names the destination for the dictionary *and* for the tests.
 *
 * It was a Spanish literal, typed again in `App.tsx`'s title map — so the two
 * could drift, and every test clicked a tile by a word that only exists in one
 * language. The key is the stable thing; the label is a rendering of it.
 */
interface TileBase {
  readonly key: string
  readonly icon: IconKey
}

/**
 * A tile is either built or promised, and **a promise names its milestone.**
 *
 * That used to be a `milestone?: string` on one shape, with a `t('hub.notBuilt')`
 * fallback for a tile nobody had scheduled. Calendari was the only tile using it,
 * and building it left the branch unreachable and the key an orphan — the fifth
 * this project would have shipped, all four earlier ones found by hand because
 * `dictionaries.test.ts` enforces parity across languages and cannot see a key
 * nobody calls.
 *
 * So the doc comment above ("a disabled tile is a promise with a date on it")
 * became the type instead of a convention: an unbuilt tile with no milestone is now
 * a compile error rather than a silent "not built yet". If a section ever needs
 * naming before the roadmap budgets it, that is three dictionary lines and a
 * deliberate decision, which is the right price.
 */
type Tile =
  | (TileBase & { readonly to: ScreenKey })
  | (TileBase & { readonly to: null; readonly milestone: string })

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
 * Seguimiento's two tiles landing on one screen is deliberate and matches the
 * reference: "where am I in the league" and "what happened at the weekend" are
 * different questions, even though one screen currently answers both.
 *
 * **Entrenador used to do the same with Alineació and Tàctiques, and no longer
 * does.** That pair never grew into two screens, because the tactical lever set
 * is closed at two by ground rule 5 (`lineup.ts` — "one slider rather than
 * five"), so the second screen would have been eight buttons and a slider. The
 * reference agrees: `squad-alineacion-formacion.png` is a single screen holding
 * the squad table *and* the shape. One tile now, and the freed slot went to
 * Entrenaments, which M6 assigns and the hub had never named.
 */
export const QUADRANTS: readonly Quadrant[] = [
  {
    key: 'seguimiento',
    title: 'quadrant.seguimiento',
    tiles: [
      { key: 'nav.table', to: 'table', icon: 'table' },
      { key: 'nav.results', to: 'results', icon: 'results' },
      { key: 'nav.calendar', to: 'calendar', icon: 'calendar' },
    ],
    figure: 'assistant',
  },
  {
    key: 'entrenador',
    title: 'quadrant.entrenador',
    tiles: [
      { key: 'nav.lineup', to: 'lineup', icon: 'pitch' },
      { key: 'nav.training', to: null, milestone: 'M6', icon: 'training' },
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

/**
 * One half of the fixture line: a crest with the club's name under it.
 *
 * `lg` on both, so the two clubs read at the same weight as the identity crest
 * directly above them. The badge is left unlabelled — the name is right there,
 * and the whole side is hidden from assistive technology anyway, which reads the
 * sentence beside it instead.
 *
 * The name wraps rather than truncates: `San Sebastián` is the longest in the
 * division and two names now share an 18rem column, so something has to give and
 * a clipped club name is worse than a two-line one.
 */
function FixtureSide({
  club,
  you,
  unknown,
}: {
  readonly club:
    { readonly id: string; readonly name: string; readonly shortName: string } | undefined
  readonly you: boolean
  readonly unknown: string
}) {
  return (
    <span className={`hub__side${you ? ' is-you' : ''}`} aria-hidden="true">
      {club !== undefined && <ClubBadge club={club} size="lg" />}
      <span className="hub__side-name">{club?.name ?? unknown}</span>
    </span>
  )
}

export function HubScreen() {
  const game = useGame((s) => s.game)
  const feed = useGame((s) => s.feed)
  const unread = useGame((s) => s.unread)
  const markRead = useGame((s) => s.markRead)
  const go = useGame((s) => s.go)
  const dispatch = useGame((s) => s.dispatch)
  const advanceToMatchday = useGame((s) => s.advanceToMatchday)
  const startNewSeason = useGame((s) => s.startNewSeason)
  const quitToLanding = useGame((s) => s.quitToLanding)
  const translator = useT()
  const { t, plural, date, money, season } = translator

  const club = game.clubs.find((c) => c.id === game.managedClubId)
  const matchday = matchdayFor(game)
  // The fixture as it is written, not as it is played from here: home first.
  // `matchdayFor` answers *your* side of it, so this is the one place that turns
  // "am I at home" back into "who is the home club".
  const homeClub = matchday === null ? undefined : matchday.home ? club : matchday.opponent
  const awayClub = matchday === null ? undefined : matchday.home ? matchday.opponent : club
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
  const [newsOpen, setNewsOpen] = useState(false)
  const notices = noticesFrom(feed, game, translator).slice(0, 12)

  return (
    <div className="hub">
      {/* `data-quadrant` carries the section's identity to the CSS, which uses it
          for the colour and for where the panel sits. The element stays a
          `<section>` with the title as its heading: that pair is how the tests —
          and a screen reader — find a quadrant. */}
      {QUADRANTS.map((quadrant) => (
        <Screen key={quadrant.key} className="hub__quadrant" data-quadrant={quadrant.key}>
          <ScreenHeading>{t(quadrant.title)}</ScreenHeading>
          <div className="hub__tiles">
            {quadrant.tiles.map((tile) => (
              <Button
                key={tile.key}
                type="button"
                className="hub__tile"
                disabled={tile.to === null}
                title={
                  tile.to === null ? t('hub.arrivesAt', { milestone: tile.milestone }) : undefined
                }
                onClick={() => tile.to !== null && go(tile.to)}
              >
                <TileIcon icon={tile.icon} />
                <span className="hub__tile-label">{t(tile.key)}</span>
                {tile.to === null && <span className="hub__tile-milestone">{tile.milestone}</span>}
              </Button>
            ))}
          </div>
          <HubFigure figure={quadrant.figure} src={artSrc(quadrant.figure)} />
        </Screen>
      ))}

      <aside className="hub__centre">
        <Screen className="hub__identity">
          <ScreenHeading className="hub__crest">
            {club !== undefined && <ClubBadge club={club} size="lg" labelled />}
            {club?.name ?? '—'}
          </ScreenHeading>
          <div className="hub__vitals">
            <Stat>
              <StatLabel>{t('hub.date')}</StatLabel>
              <StatValue className="hub__date">{date(game.season.currentDate)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('hub.position')}</StatLabel>
              {/* Colour is never the only signal — the band's name is on the element
                  and available to a screen reader, exactly as the table's rows do it. */}
              <StatValue
                className={`hub__position ${band?.className ?? ''}`}
                title={band === null ? undefined : t(band.label)}
              >
                {standing.position > 0 ? standing.position : '—'}
                {/* The leading space is load-bearing: without it the accessible name
                    runs together as "20Relegated", the same wart a disabled hub tile
                    has with its milestone badge. */}
                {band !== null && <VisuallyHidden> {t(band.label)}</VisuallyHidden>}
              </StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('hub.budget')}</StatLabel>
              <StatValue className="hub__date">{money(club?.budget ?? 0)}</StatValue>
            </Stat>
          </div>
          {/* How the team is actually going, which the hub said nothing about — the
              classification answered it in a table you had to go and read. Derived
              from the fixtures rather than the news feed: the feed is session-only
              and capped, so a strip built on it would blank after a reload. */}
          <FormStrip results={form} names={clubName} translator={translator} />
        </Screen>

        <Screen className="hub__next">
          <ScreenHeading>{t('hub.nextMatch')}</ScreenHeading>
          {game.board.sacked ? (
            <p className="hub__warning" role="status">
              {t('hub.dismissed', { target: game.board.target })}
            </p>
          ) : matchday === null ? (
            <ScreenNote>{t('hub.seasonOver')}</ScreenNote>
          ) : (
            <div className="hub__next-body">
              {/*
                The fixture as a fixture: two crests with the home club on the
                left, which is how one is written everywhere. **Order is what
                says where the match is played** — so the `(L)`/`(V)` letter that
                used to sit here is a second copy of the same fact for the eye,
                and it is gone. What order cannot say is which side is *yours*,
                so that one takes `is-you`, the gold five other screens already
                use for exactly this question.

                The visual half is `aria-hidden` and the sentence beneath it is
                the string a screen reader heard before this change, venue letter
                and all. That is deliberate: the letter leaving the screen must
                not take the venue away from anyone who cannot see the order, and
                announcing both would say the same thing twice.
              */}
              <p className="hub__fixture">
                <VisuallyHidden>{describeOpponent(translator, matchday)}</VisuallyHidden>
                <FixtureSide
                  club={homeClub}
                  you={matchday.home}
                  unknown={t('fixture.unknownClub')}
                />
                <span className="hub__versus" aria-hidden="true">
                  –
                </span>
                <FixtureSide
                  club={awayClub}
                  you={!matchday.home}
                  unknown={t('fixture.unknownClub')}
                />
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
            The clock, beside the fixture it is about. Four states in priority
            order — the sack ends the career, the season ending is the door to the
            summer, a fixture being due makes kicking off a deliberate press
            rather than a side effect of advancing a day; otherwise it just runs.

            **Advancing a day is not here.** It is the footer's, on every screen
            including this one, so the press that runs the clock is always in the
            same corner. What stays is what belongs *beside the fixture*: kicking
            off, which is the one irreversible press and wants to be made where
            you can see who you are playing; skipping ahead to the match; and the
            two season boundaries. The four states below are still mutually
            exclusive with the footer's one, so no label is ever on screen twice.
          */}
          <ScreenActions className="hub__controls">
            {game.board.sacked ? (
              // The end of the job, and the end of the career. There is no path
              // on from here — the only button left is a new one somewhere else.
              <Button primary type="button" onClick={quitToLanding}>
                {t('action.quit')}
              </Button>
            ) : finished ? (
              <Button primary type="button" onClick={() => startNewSeason()}>
                {t('hub.startSeason', { season: season(game.season.startYear + 1) })}
              </Button>
            ) : matchday !== null && matchday.due ? (
              <Button
                primary
                type="button"
                className="hub__play"
                onClick={() => dispatch({ type: 'AdvanceDay' })}
              >
                {t('hub.playMatch', { opponent: describeOpponent(translator, matchday) })}
              </Button>
            ) : (
              matchday !== null && (
                <Button type="button" onClick={advanceToMatchday}>
                  {t('hub.toMatchday')}
                </Button>
              )
            )}
          </ScreenActions>
        </Screen>

        <Screen className="hub__news">
          {/* The heading stays a heading, and the control sits beside it.
              *
              Making the `<h2>` itself the button folded the count into its
              accessible name — "News3 unread" — and two other test files find
              this panel by that name. They were right to: the heading is the
              panel's identity and should not change every time something
              happens. The button carries the count instead.
              *
              A press rather than a glance is deliberate: this panel is always on
              screen here, so clearing on sight is exactly what made the first
              version of this badge useless. */}
          <div className="hub__news-head">
            <ScreenHeading className="hub__news-title">{t('hub.news')}</ScreenHeading>
            <Button
              type="button"
              className="hub__news-open"
              onClick={() => {
                setNewsOpen(true)
                markRead()
              }}
            >
              {t('hub.readNews')}
              {unread > 0 && (
                <>
                  {/* `aria-hidden` on the pill, because the sentence beside it
                      says the same number. Both rendered plainly announces
                      "See all 3 3 unread" — the fourth instance of that defect
                      here after `CanteraM7`, `20Relegated` and the footer
                      button this replaces. The explicit `{' '}` matters: a
                      literal leading space inside the span is eaten the moment
                      the formatter breaks the line. */}
                  <span className="hub__unread" aria-hidden="true">
                    {unread}
                  </span>
                  <VisuallyHidden> {plural('action.unread', unread)}</VisuallyHidden>
                </>
              )}
            </Button>
          </div>
          <NotificationList notices={notices} empty={t('hub.noNews')} />
        </Screen>
      </aside>

      {newsOpen && (
        <Modal
          title={t('hub.news')}
          onClose={() => {
            setNewsOpen(false)
          }}
        >
          {/* The whole feed. The panel behind it shows the latest twelve, which is
              what makes this worth opening rather than a second copy of it. */}
          <NotificationList notices={noticesFrom(feed, game, translator)} empty={t('hub.noNews')} />
          <ScreenActions>
            <Button
              type="button"
              onClick={() => {
                setNewsOpen(false)
              }}
            >
              {t('action.close')}
            </Button>
          </ScreenActions>
        </Modal>
      )}
    </div>
  )
}
