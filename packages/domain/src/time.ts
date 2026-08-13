/**
 * The day clock. Ground rule 4 — ticks are days — and ground rule 1, which bans
 * `Date` outright: the clock is state, not wall time.
 *
 * A date is an integer count of days from 1970-01-01. That choice follows the
 * operations this codebase actually performs. Adding days (every tick, every
 * injury recovery, every contract check) is `+`; comparing dates (has this fixture
 * been played, has the window closed) is `<`. Under a `{ y, m, d }` record both
 * become calendar-aware functions at every call site, which is where off-by-one
 * bugs breed. The operations a record makes easy — "is it 30 June" — happen only
 * at boundaries and cost one conversion.
 *
 * `currentDate + 1` is also literally the tick.
 *
 * All calendar risk therefore lives in `fromCivil`/`toCivil` below, which are
 * round-trip tested across four centuries.
 */

/**
 * Days since the 1970-01-01 epoch. Branded so a rating, an id or a goal count
 * cannot be passed where a date belongs — the branding is type-level only, so
 * `erasableSyntaxOnly` is untouched and this compiles away to a number.
 */
export type DayNumber = number & { readonly __day: unique symbol }

/** Year, month (1–12), day (1–31). */
export interface CivilDate {
  readonly y: number
  readonly m: number
  readonly d: number
}

/**
 * Howard Hinnant's `days_from_civil`, which shifts the epoch to 0000-03-01 so
 * that the leap day lands at the end of the year and the era arithmetic stays
 * branch-free. Valid across any range this game will ever reach.
 */
export function fromCivil(y: number, m: number, d: number): DayNumber {
  const year = m <= 2 ? y - 1 : y
  const era = Math.floor(year / 400)
  const yoe = year - era * 400 // [0, 399]
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1 // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy // [0, 146096]
  return (era * 146097 + doe - 719468) as DayNumber
}

/** Inverse of {@link fromCivil} — Hinnant's `civil_from_days`. */
export function toCivil(day: DayNumber): CivilDate {
  const z = day + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097 // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  ) // [0, 399]
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)) // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153) // [0, 11]
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1 // [1, 31]
  const m = mp + (mp < 10 ? 3 : -9) // [1, 12]
  return { y: m <= 2 ? y + 1 : y, m, d }
}

export function addDays(day: DayNumber, n: number): DayNumber {
  return (day + n) as DayNumber
}

export function daysBetween(from: DayNumber, to: DayNumber): number {
  return to - from
}

/** 0 = Sunday. 1970-01-01 was a Thursday, hence the +4. */
export function dayOfWeek(day: DayNumber): number {
  return ((day % 7) + 11) % 7
}

/** `2026-08-15`. Display only — never parse this back, use {@link fromCivil}. */
export function formatDate(day: DayNumber): string {
  const { y, m, d } = toCivil(day)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
