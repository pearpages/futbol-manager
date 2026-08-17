import { describe, expect, it } from 'vitest'
import { seasonEvents } from './calendar.ts'
import type { ClubId } from './entities.ts'
import { isSettlementDay } from './finance.ts'
import { CLUB_COUNT, generateFixtures } from './fixtures.ts'
import { isTransferWindowOpen } from './market.ts'
import { fromCivil, toCivil } from './time.ts'

const clubIds = Array.from({ length: CLUB_COUNT }, (_, i) => `c${i + 1}` as ClubId)
const seasonStart = fromCivil(2026, 8, 15)
const fixtures = generateFixtures(clubIds, seasonStart)
const events = seasonEvents(fixtures)

/** `01/09` — enough to read a date in a failure message. */
function civil(day: number) {
  const { d, m } = toCivil(day as never)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

describe('seasonEvents', () => {
  it('runs in date order', () => {
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.date >= events[i - 1]!.date, `${civil(events[i]!.date)}`).toBe(true)
    }
  })

  it('stays inside the season as scheduled', () => {
    const dates = fixtures.map((f) => f.date)
    const first = Math.min(...dates)
    const last = Math.max(...dates)

    for (const event of events) {
      expect(event.date >= first && event.date <= last, civil(event.date)).toBe(true)
    }
  })

  it('has nothing to say about an empty fixture list', () => {
    expect(seasonEvents([])).toEqual([])
  })

  /*
   * Nine, not twelve — the clock runs 15 August to 1 May and never sees June or
   * July. Pinned because it is a real and load-bearing property of the model
   * rather than a coincidence of this fixture set: every club pays nine twelfths
   * of its contractual wage bill and collects nine twelfths of its TV money.
   * `CLAUDE.md` records it as a known defect, and this is the assertion that will
   * fail loudly when somebody fixes it.
   */
  it('reaches nine settlement days in a season', () => {
    const settlements = events.filter((e) => e.kind === 'settlement')
    expect(settlements).toHaveLength(9)
    expect(settlements.map((e) => civil(e.date))).toEqual([
      '01/09',
      '01/10',
      '01/11',
      '01/12',
      '01/01',
      '01/02',
      '01/03',
      '01/04',
      '01/05',
    ])
  })

  /*
   * The summer opening is *not* in this list, and that is correct rather than a
   * gap: the window opens on 1 July and the day clock never enters July — the
   * rollover jumps from the end of a season straight to 15 August, arriving with
   * the market already open. The same fact is why `TransferWindowChanged` needed
   * a second emission site and why `transferWindowDaysLeft` needed its own test.
   */
  it('names the two window edges the season actually crosses', () => {
    const edges = events.filter((e) => e.kind === 'windowCloses' || e.kind === 'windowOpens')
    expect(edges.map((e) => [e.kind, civil(e.date)])).toEqual([
      ['windowCloses', '01/09'],
      ['windowOpens', '01/01'],
      ['windowCloses', '01/02'],
    ])
  })

  /*
   * A tie is the normal case, not the exception: three of the four kinds routinely
   * share a date with another. Deduplicating to one row per date would silently
   * drop whichever the sort happened to put second.
   */
  it('keeps both events that fall on 1 September, market before money', () => {
    const first = fromCivil(2026, 9, 1)
    expect(events.filter((e) => e.date === first).map((e) => e.kind)).toEqual([
      'windowCloses',
      'settlement',
    ])
  })

  it('closes on the last fixture, whatever else falls that day', () => {
    const last = Math.max(...fixtures.map((f) => f.date))
    const final = events.at(-1)

    expect(final?.kind).toBe('seasonEnds')
    expect(final?.date).toBe(last)
    // 1 May is a settlement day too, so this is a tie the order has to settle.
    expect(events.filter((e) => e.date === last).map((e) => e.kind)).toEqual([
      'settlement',
      'seasonEnds',
    ])
  })

  /*
   * The point of walking the days rather than recomputing the rule. Every window
   * edge and every settlement date has to agree with the predicate the reducer
   * itself consults — a calendar naming a deadline the game does not honour is
   * worse than no calendar.
   */
  it('agrees with the predicates the reducer uses', () => {
    for (const event of events) {
      if (event.kind === 'settlement') {
        expect(isSettlementDay(event.date), civil(event.date)).toBe(true)
      }
      if (event.kind === 'windowCloses') {
        expect(isTransferWindowOpen(event.date), civil(event.date)).toBe(false)
      }
      if (event.kind === 'windowOpens') {
        expect(isTransferWindowOpen(event.date), civil(event.date)).toBe(true)
      }
    }
  })

  /*
   * The one that proves the dates are walked rather than written down — and it
   * reaches the case a real career cannot.
   *
   * A January start runs to late September, so its span *contains July*: the
   * summer opening on 1 July shows up, and the window that opens there stays open
   * through August and closes on 1 September. That is the fact the whole design is
   * built around ("July and August are one window"), and the normal 15 August
   * season can never exercise it because the clock never enters July.
   */
  it('finds the July opening when the span reaches it', () => {
    const shifted = seasonEvents(generateFixtures(clubIds, fromCivil(2027, 1, 10)))
    const edges = shifted.filter((e) => e.kind === 'windowCloses' || e.kind === 'windowOpens')

    expect(edges.map((e) => [e.kind, civil(e.date)])).toEqual([
      ['windowCloses', '01/02'],
      ['windowOpens', '01/07'],
      ['windowCloses', '01/09'],
    ])
  })
})
