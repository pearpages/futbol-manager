import { useGame } from '../store.ts'
import {
  type ClubPhraseOptions,
  clubPhrase,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  formatSeason,
  formatTicket,
  LOCALE_TAGS,
} from './format.ts'
import { type Language, type Params, translate, translatePlural } from './index.ts'

/**
 * Everything a component needs to render words and numbers.
 *
 * One hook rather than several, because a screen that translates almost always
 * also formats money — `t` and `money` arriving separately would mean two
 * subscriptions to the same value and two chances to forget one.
 */
export interface Translator {
  readonly language: Language
  /** A string by key, with `{name}` parameters filled in. */
  t(key: string, params?: Params): string
  /** Picks singular or plural on `count`, which is also passed to the string. */
  plural(key: string, count: number, params?: Params): string
  /** Thousands, per this language's conventions. */
  money(thousands: number): string
  /** A single ticket, which wants cents. */
  ticket(thousands: number): string
  /** A whole number with thousands separators. */
  count(value: number): string
  /** A fraction as a percentage — `0.7` → `70%`. */
  percent(fraction: number, decimals?: number): string
  /** A date, numerically. */
  date(day: number): string
  /** `2026` → `2026/27`. */
  season(startYear: number): string
  /**
   * A club's name with its article — `el Madrid`, `l’Elche`, `al Madrid`.
   *
   * Only ever a real club's name. The fallbacks the callers hold for a club
   * they cannot resolve (`un altre club`, `La junta`) carry their own
   * determiner and must go into the sentence untouched.
   */
  club(name: string, options?: ClubPhraseOptions): string
  /** For `localeCompare` — Catalan collation is genuinely its own. */
  readonly locale: string
}

export function translatorFor(language: Language): Translator {
  return {
    language,
    t: (key, params) => translate(language, key, params),
    plural: (key, count, params) => translatePlural(language, key, count, params),
    money: (thousands) => formatMoney(language, thousands),
    ticket: (thousands) => formatTicket(language, thousands),
    count: (value) => formatCount(language, value),
    percent: (fraction, decimals) => formatPercent(language, fraction, decimals),
    date: (day) => formatDate(language, day as never),
    season: formatSeason,
    club: (name, options) => clubPhrase(language, name, options),
    locale: LOCALE_TAGS[language],
  }
}

/**
 * Subscribes to the language and nothing else, so changing it re-renders every
 * screen and changing the game does not re-render on its account.
 */
export function useT(): Translator {
  const language = useGame((s) => s.language)
  return translatorFor(language)
}
