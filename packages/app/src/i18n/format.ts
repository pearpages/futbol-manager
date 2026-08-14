import { type DayNumber, toCivil } from '@fm/domain'
import type { Language } from './index.ts'

/**
 * Numbers, money and dates, per language.
 *
 * `domain` deliberately keeps deciding the *unit* — `formatMoney`'s own comment
 * says the function that knows the unit should print it, and that is right. What
 * it cannot know is where the symbol goes: English writes `€12.4M`, Catalan and
 * Spanish write `12,4 M€` with a comma. So the unit decision moves here intact
 * and only the presentation changes.
 *
 * These are plain functions of a language rather than hooks, so the notification
 * builder — which is not a component — can use them too.
 */

interface Conventions {
  /** Between the integer and its fraction. */
  readonly decimal: string
  /** Between thousands. */
  readonly group: string
  /** True when the currency symbol trails the number, with a space. */
  readonly currencyAfter: boolean
  /** Day/month/year order for a numeric date. */
  readonly dateOrder: 'ymd' | 'dmy'
  /** True where a percent sign is written with a space before it. */
  readonly percentSpace: boolean
}

const CONVENTIONS: Readonly<Record<Language, Conventions>> = {
  ca: { decimal: ',', group: '.', currencyAfter: true, dateOrder: 'dmy', percentSpace: true },
  es: { decimal: ',', group: '.', currencyAfter: true, dateOrder: 'dmy', percentSpace: true },
  en: { decimal: '.', group: ',', currencyAfter: false, dateOrder: 'ymd', percentSpace: false },
}

/** `45000` → `45.000` in Catalan, `45,000` in English. */
export function formatCount(language: Language, value: number): string {
  const { group } = CONVENTIONS[language]
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, group)
}

function withSymbol(language: Language, text: string, unit: string): string {
  const { currencyAfter } = CONVENTIONS[language]
  return currencyAfter ? `${text} ${unit}€` : `€${text}${unit}`
}

/**
 * Money, in thousands — the unit every figure in this game is quoted in.
 *
 * The magnitude rule is `formatMoney`'s, unchanged: millions to one decimal,
 * because `12.4M` reads at a glance where `12,350k` does not.
 */
export function formatMoney(language: Language, thousands: number): string {
  const { decimal } = CONVENTIONS[language]
  const value = Math.round(thousands)

  if (Math.abs(value) >= 1000) {
    const millions = value / 1000
    const fixed = Math.abs(millions) >= 100 ? millions.toFixed(0) : millions.toFixed(1)
    // Strip a trailing `.0` before the separator is swapped — doing it after
    // would need the regex to know which separator it was looking for.
    return withSymbol(language, fixed.replace(/\.0$/, '').replace('.', decimal), 'M')
  }

  return withSymbol(language, formatCount(language, value), 'k')
}

/**
 * A fraction as a percentage — `0.227` → `22.7%`, or `22,7 %` in ca/es.
 *
 * `decimals` is a parameter because the two uses want different things: a model
 * weight is a round `70%`, while a keeper's share of the defence is `35%` and a
 * forward's share of the defence is `1.5%`, which rounds to nothing useful whole.
 */
export function formatPercent(language: Language, fraction: number, decimals = 0): string {
  const { decimal, percentSpace } = CONVENTIONS[language]
  const text = (fraction * 100).toFixed(decimals).replace(/\.0$/, '').replace('.', decimal)
  return percentSpace ? `${text} %` : `${text}%`
}

/** A single ticket, which is small enough to want cents. */
export function formatTicket(language: Language, thousands: number): string {
  const { decimal } = CONVENTIONS[language]
  return withSymbol(language, (thousands * 1000).toFixed(2).replace('.', decimal), '')
}

/**
 * A date, numerically.
 *
 * Numeric rather than named on purpose: month names would be thirty-six more
 * dictionary entries to say something two slashes already say. `toCivil` hands
 * back `{ y, m, d }` as numbers, which is exactly the seam for this — and it
 * means `domain` never needs a calendar word.
 */
export function formatDate(language: Language, day: DayNumber): string {
  const { y, m, d } = toCivil(day)
  const yyyy = String(y).padStart(4, '0')
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')

  return CONVENTIONS[language].dateOrder === 'dmy' ? `${dd}/${mm}/${yyyy}` : `${yyyy}-${mm}-${dd}`
}

/** `2026` → `2026/27`. The same in all three languages, but written once. */
export function formatSeason(startYear: number): string {
  return `${String(startYear)}/${String(startYear + 1).slice(2)}`
}

/**
 * The locale tag for `localeCompare` and `<html lang>`.
 *
 * Catalan collation is genuinely different — `ç` sorts with `c`, `l·l` with `l` —
 * so a sorted market list is wrong without it.
 */
export const LOCALE_TAGS: Readonly<Record<Language, string>> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
}
