import { useMemo, useState } from 'react'
import { type ClubId, computeTable, recentResultsFor } from '@fm/domain'
import { bandFor } from '../bands.ts'
import { useT } from '../i18n/useT.ts'
import { describeOpponent, matchdayFor, weakLineup } from '../matchday.ts'
import { noticesFrom } from '../notifications.ts'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { NewsDialog } from './NewsDialog.tsx'
import { FORM_MATCHES, FormStrip } from './FormStrip.tsx'
import {
  Button,
  NotificationList,
  Screen,
  ScreenHeading,
  ScreenNote,
  Stat,
  StatLabel,
  StatValue,
  VisuallyHidden,
} from '@fm/design-system'
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
  const translator = useT()
  const { t, plural, date, money } = translator

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
  const [newsOpen, setNewsOpen] = useState(false)
  const notices = noticesFrom(feed, game, translator).slice(0, 12)

  return (
    <div className="hub">
      {/* `data-quadrant` carries the section's identity to the CSS, which uses it
          for the colour and for where the panel sits. The element stays a
          `<section>` with the title as its heading: that pair is how the tests —
          and a screen reader — find a quadrant. */}
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
          {/* Phone only: the hub sections are gone there, and what the board wants
              is the one number that ends a career. */}
          <button
            type="button"
            className="hub__target"
            onClick={() => {
              go('decisiones')
            }}
          >
            {t('hub.boardTarget', { target: game.board.target })}
          </button>
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
              {/* Phone only: the round left the bar there (ADR 0019). */}
              <p className="hub__round">{t('shell.matchday', { round: matchday.fixture.round })}</p>
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
              icon="news"
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
        <NewsDialog
          onClose={() => {
            setNewsOpen(false)
          }}
        />
      )}
    </div>
  )
}
