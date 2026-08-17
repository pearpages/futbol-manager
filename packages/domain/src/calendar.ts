import type { Fixture } from './entities.ts'
import { isSettlementDay } from './finance.ts'
import { isTransferWindowOpen } from './market.ts'
import { addDays, type DayNumber } from './time.ts'

/**
 * The season's dated obligations — everything the game enforces on a particular
 * day that is not a match.
 *
 * A manager could always see the next fixture and the last ten results, and never
 * a date for anything else. The transfer deadline existed only as a countdown in
 * the corner; the settlement day that pays every wage and collects every TV cheque
 * was `toCivil(date).d === 1` and was stated nowhere at all. Those are rules with
 * dates on them, and nothing in the game showed a date.
 *
 * **The dates are read from the live predicates, never recomputed here.** This
 * walks the season's days and asks `isTransferWindowOpen` and `isSettlementDay`
 * rather than deriving "the first of each month" and "the month after the window's
 * last month" a second time. Two reasons, and the first is the weaker one:
 *
 * - A calendar that names a deadline the reducer does not honour is worse than no
 *   calendar. `explain-topics.ts` argues the same for prose naming a constant, and
 *   help text contradicting the game is the identical defect wearing a date.
 * - It cannot re-enter the July trap. `transferWindowDaysLeft` needed a test of its
 *   own because "the month after this month" is wrong for July — July and August
 *   are one window — and no career ever enters July, so nothing else would catch
 *   it. A day-walk over the season's own span never asks the question.
 *
 * Two hundred and fifty-nine days against two boolean predicates, which is cheaper
 * than the cross-table this feeds a screen beside.
 *
 * Draws no randomness and is called from no reducer, so it adds no state and moves
 * no calibrated band.
 */

export type SeasonEventKind = 'windowOpens' | 'windowCloses' | 'settlement' | 'seasonEnds'

export interface SeasonEvent {
  readonly kind: SeasonEventKind
  readonly date: DayNumber
}

/**
 * Ties are the normal case rather than the exception.
 *
 * **1 September is a window close *and* a settlement day**, and so is 1 February;
 * 1 January is a window *opening* and a settlement day; and the last round's date
 * is a settlement day too. So three of the four kinds routinely share a date with
 * another. The market moves before the money because the deadline is the thing a
 * manager is watching, and the season's end closes the list whatever falls on it.
 *
 * **Removing this tiebreak fails no test, and that is the reason to keep it.**
 * `Array.prototype.sort` is stable and the loop below happens to push a window
 * edge before a settlement, so the rendered order would be correct — and would be
 * the *statement order inside the loop*, silently, with nothing saying so. Move
 * those two `push` calls and every tie flips. Measured both ways: with the
 * tiebreak the loop's order is irrelevant; without it, reordering the loop fails
 * the 1 September test.
 */
const KIND_ORDER: readonly SeasonEventKind[] = [
  'windowOpens',
  'windowCloses',
  'settlement',
  'seasonEnds',
]

/**
 * Every dated obligation between the season's first and last fixture, in order.
 *
 * Bounded by the fixture list rather than by the clock, so it describes the season
 * as scheduled and does not change as the days are played. Returns `[]` for an
 * empty fixture set.
 */
export function seasonEvents(fixtures: readonly Fixture[]): SeasonEvent[] {
  let first: DayNumber | null = null
  let last: DayNumber | null = null
  for (const fixture of fixtures) {
    if (first === null || fixture.date < first) first = fixture.date
    if (last === null || fixture.date > last) last = fixture.date
  }
  if (first === null || last === null) return []

  const events: SeasonEvent[] = []

  for (let day = first; day <= last; day = addDays(day, 1)) {
    // The window is a predicate, so an opening is a *change across two dates* —
    // there is no moment the market itself fires. Comparing against the previous
    // day means the season's first day reports a change only if it genuinely is
    // one, and 15 August never is: the window is already open when the clock
    // arrives.
    const open = isTransferWindowOpen(day)
    if (open !== isTransferWindowOpen(addDays(day, -1))) {
      events.push({ kind: open ? 'windowOpens' : 'windowCloses', date: day })
    }

    if (isSettlementDay(day)) events.push({ kind: 'settlement', date: day })
  }

  events.push({ kind: 'seasonEnds', date: last })

  return events.sort((a, b) => a.date - b.date || order(a.kind) - order(b.kind))
}

function order(kind: SeasonEventKind): number {
  return KIND_ORDER.indexOf(kind)
}
