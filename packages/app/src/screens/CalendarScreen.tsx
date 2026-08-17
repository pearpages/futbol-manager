import { useEffect, useMemo, useRef } from 'react'
import {
  type Club,
  type ClubId,
  type DayNumber,
  type Fixture,
  type SeasonEvent,
  seasonEvents,
} from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { ClubBadge } from './ClubBadge.tsx'
import { Explain } from './Explain.tsx'
import './CalendarScreen.css'

/**
 * The season as a list of dates — your thirty-eight fixtures with the league's
 * deadlines interleaved where they fall.
 *
 * **Deliberately not a second Resultats.** That screen answers "what happened", as
 * a twenty-by-twenty cross-table with no room for a date and no notion of the
 * future. This one answers "what is coming, and when": the run of fixtures ahead,
 * the day the market shuts, the day the wages go out, the day the season ends. The
 * game enforced every one of those and showed a date for none of them.
 *
 * The rows are chronological and **nothing here sorts**. The order *is* the
 * information — a sortable date column would let you destroy the one thing the
 * screen is for — which is the same reason `TableScreen` leaves `#` unsortable.
 *
 * **No aside rail either.** Everything a rail would carry is already on the hub or
 * in the shell corner: the next match with its countdown, the days of market left,
 * the league position. This project keeps getting bitten by the weaker of two
 * copies winning the click (the roadmap's open item 8 is exactly that), so the
 * screen states its mechanism in one `<Explain>` and stops.
 */

/** A fixture row and a deadline row are different rows, not one row with holes. */
type Entry =
  | { readonly kind: 'fixture'; readonly date: DayNumber; readonly fixture: Fixture }
  | { readonly kind: 'event'; readonly date: DayNumber; readonly event: SeasonEvent }

const EVENT_LABEL: Readonly<Record<SeasonEvent['kind'], string>> = {
  windowOpens: 'calendar.windowOpens',
  windowCloses: 'calendar.windowCloses',
  settlement: 'calendar.settlement',
  seasonEnds: 'calendar.seasonEnds',
}

type Outcome = 'win' | 'draw' | 'loss'

const OUTCOME_LABEL: Readonly<Record<Outcome, string>> = {
  win: 'calendar.won',
  draw: 'calendar.drew',
  loss: 'calendar.lost',
}

export function CalendarScreen() {
  const game = useGame((s) => s.game)
  const { t, date, season } = useT()
  const nextRow = useRef<HTMLTableRowElement | null>(null)

  const clubs = useMemo(
    // `game.clubs` rather than `game`: the day tick replaces the state wholesale but
    // leaves this array alone, and the alternative rebuilds twenty entries a tick.
    () => new Map(game.clubs.map((c) => [c.id, c])),
    [game.clubs],
  )

  /*
   * Rebuilt only when the fixture list itself changes. `seasonEvents` walks 259
   * days, and `advanceDay` fires on every press — memoising on `game` would pay for
   * the walk again every time the clock moved, which is exactly when the answer
   * cannot have changed.
   */
  const entries = useMemo<Entry[]>(() => {
    const mine = game.season.fixtures.filter(
      (f) => f.homeId === game.managedClubId || f.awayId === game.managedClubId,
    )

    const rows: Entry[] = [
      ...mine.map((fixture) => ({ kind: 'fixture' as const, date: fixture.date, fixture })),
      ...seasonEvents(game.season.fixtures).map((event) => ({
        kind: 'event' as const,
        date: event.date,
        event,
      })),
    ]

    // A match and a deadline can share a day — the last round falls on 1 May, which
    // is a settlement day. The fixture leads: it is why you are looking.
    return rows.sort((a, b) => a.date - b.date || (a.kind === 'fixture' ? -1 : 1))
  }, [game.season.fixtures, game.managedClubId])

  /*
   * The next fixture a manager has to play, which is **not** the first unplayed row
   * by date. `advanceDay` resolves everything *due*, so a fixture the clock has
   * already passed is still owed and is still the next one — `nextFixtureFor` is
   * emphatic about this, and keying off the round or the date would point at the
   * wrong row exactly when a manager most needs the right one.
   *
   * Reuses that function rather than re-deriving it; `matchdayFor` is the wrong
   * helper here because it also resolves the opponent and the countdown for the
   * hub's panel, and only the id is wanted.
   */
  const nextId = useMemo(() => {
    let next: Fixture | null = null
    for (const entry of entries) {
      if (entry.kind !== 'fixture' || entry.fixture.result !== null) continue
      if (next === null || entry.fixture.date < next.date) next = entry.fixture
    }
    return next?.id ?? null
  }, [entries])

  /*
   * Open where the season is, not at jornada 1 in August.
   *
   * `block: 'center'` rather than `'nearest'` so the fixtures *ahead* are visible
   * too — landing with the next match on the last visible line would show only what
   * is already over. jsdom implements no scrolling at all, so `test-setup.ts` shims
   * this; the shim predates this screen.
   */
  useEffect(() => {
    nextRow.current?.scrollIntoView({ block: 'center' })
  }, [nextId])

  return (
    <section className="screen calendar-screen">
      <h2 className="screen__heading">
        {t('calendar.heading', { season: season(game.season.startYear) })}
        <Explain topic="calendar" />
      </h2>

      {/* Its own scroll container, because `.screen` carries `overflow: auto` and
          would otherwise take the heading — and the "i" that explains the deadline
          rows — up and out of sight with the fixtures. The screenshot that caught
          this had scrolled 218px to reach November, and the explainer was simply
          gone. `ResultsScreen` had already paid for the same lesson. */}
      <div className="calendar-screen__scroll">
        <table className="data-table calendar-screen__table">
          <thead className="data-table__head">
            <tr>
              <th>{t('calendar.column.round')}</th>
              <th className="is-text">{t('calendar.column.date')}</th>
              <th className="is-text">{t('calendar.column.opponent')}</th>
              <th>{t('calendar.column.result')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.kind === 'event' ? (
                <tr
                  key={`${entry.event.kind}-${String(entry.date)}`}
                  className={`data-table__row calendar-screen__event${
                    entry.event.kind === 'settlement' ? ' is-quiet' : ''
                  }`}
                >
                  {/* An em dash rather than an empty cell: a deadline has no jornada,
                    and a blank there reads as a fixture whose number went missing. */}
                  <td className="data-table__num" aria-hidden="true">
                    —
                  </td>
                  <td className="is-text">{date(entry.date)}</td>
                  <td className="is-text" colSpan={2}>
                    {t(EVENT_LABEL[entry.event.kind])}
                  </td>
                </tr>
              ) : (
                <FixtureRow
                  key={entry.fixture.id}
                  fixture={entry.fixture}
                  clubs={clubs}
                  managedClubId={game.managedClubId}
                  isNext={entry.fixture.id === nextId}
                  ref={entry.fixture.id === nextId ? nextRow : undefined}
                />
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

interface FixtureRowProps {
  readonly fixture: Fixture
  readonly clubs: ReadonlyMap<ClubId, Club>
  readonly managedClubId: ClubId
  readonly isNext: boolean
  /** Set on the next fixture only, so the screen can scroll it into view. */
  readonly ref?: React.Ref<HTMLTableRowElement> | undefined
}

function FixtureRow({ fixture, clubs, managedClubId, isNext, ref }: FixtureRowProps) {
  const { t, date } = useT()

  const home = fixture.homeId === managedClubId
  const opponent = clubs.get(home ? fixture.awayId : fixture.homeId)

  /*
   * **An away 0–2 is a win.** `ours` and `theirs` swap on venue, and reading them
   * straight off the score inverts every away row — a screen that is wrong exactly
   * half the time and entirely plausible either way, because nobody checks a result
   * against a scoreline. `recentResultsFor` and the results grid's axes both carry
   * the same warning; this is the third place it has to be got right.
   */
  const score =
    fixture.result === null
      ? null
      : {
          ours: home ? fixture.result.home : fixture.result.away,
          theirs: home ? fixture.result.away : fixture.result.home,
        }

  const outcome: Outcome | null =
    score === null
      ? null
      : score.ours > score.theirs
        ? 'win'
        : score.ours < score.theirs
          ? 'loss'
          : 'draw'

  return (
    <tr
      ref={ref}
      className={`data-table__row${isNext ? ' is-you calendar-screen__next' : ''}`}
      aria-current={isNext ? 'true' : undefined}
    >
      <td className="data-table__num">{fixture.round}</td>
      <td className="is-text">{date(fixture.date)}</td>
      <td className="is-text">
        <span className="club-cell">
          {opponent !== undefined && <ClubBadge club={opponent} />}
          {/* Reuses the keys the hub's next-match panel renders. The venue letter
              abbreviates a *word* and the words differ — Catalan local/visitant,
              Spanish casa/fuera — so it is a whole phrase per language rather than
              an "(H)"/"(A)" assembled here. */}
          {t(home ? 'fixture.home' : 'fixture.away', {
            club: opponent?.name ?? t('fixture.unknownClub'),
          })}
        </span>
      </td>
      <td className={`calendar-screen__score${outcome === null ? '' : ` is-${outcome}`}`}>
        {outcome === null || score === null ? (
          <span aria-hidden="true">—</span>
        ) : (
          <>
            {score.ours}–{score.theirs}
            {/* Colour is never the only signal — the same rule the position bands
                and the form strip follow. The leading space is deliberate: nothing
                in the DOM separates this from the score, and running them together
                is how "CanteraM7" and "20Relegated" happened. */}
            <span className="visually-hidden"> {t(OUTCOME_LABEL[outcome])}</span>
          </>
        )}
      </td>
    </tr>
  )
}
