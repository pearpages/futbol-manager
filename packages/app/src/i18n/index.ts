import { ca } from './ca.ts'
import { en } from './en.ts'
import { es } from './es.ts'

/**
 * Three languages, hand-rolled.
 *
 * No dependency, per `stack.md`: a flat dictionary with `{name}` substitution is
 * forty lines, and this is a codebase that hand-writes its own PRNG rather than
 * take one. A library would buy plural rules for languages we do not ship and a
 * loader for files we import directly.
 *
 * **Keys are the source of truth, not English.** Using the English sentence as
 * the key looks tidier and rots: change the wording and every other language
 * silently falls back. `dictionaries.test.ts` asserts all three carry exactly the
 * same keys, in both directions.
 *
 * **Sentences are whole.** Nothing here is assembled from translated fragments —
 * "Beat" + opponent + score works in English and nowhere else, because word order
 * and agreement are not portable. Where a sentence has moving parts they are
 * parameters inside one string.
 */

export const LANGUAGES = ['ca', 'es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** What the cog shows. Each in its own language, as language menus always are. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  ca: 'Català',
  es: 'Español',
  en: 'English',
}

export type Dictionary = Readonly<Record<string, string>>

const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { ca, es, en }

/**
 * Catalan, because it is the language of the person this was built for. The
 * other two are one press of the cog away.
 */
export const DEFAULT_LANGUAGE: Language = 'ca'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export type Params = Readonly<Record<string, string | number>>

/**
 * Look up a key and fill in its parameters.
 *
 * A missing key returns the key itself rather than throwing or rendering empty.
 * A blank space in the UI is a bug you do not notice; `market.filter.budget` on
 * screen is one you cannot miss — and the parity test means it should never
 * happen in the first place.
 */
export function translate(language: Language, key: string, params?: Params): string {
  const text = DICTIONARIES[language][key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key
  if (params === undefined) return text

  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    return value === undefined ? whole : String(value)
  })
}

/**
 * Picks the singular or plural form.
 *
 * All three languages have the same simple one/other split, so this is two keys
 * rather than a plural-rules engine. `count` is passed through, so the string
 * itself can say `{count}`.
 */
export function translatePlural(
  language: Language,
  key: string,
  count: number,
  params?: Params,
): string {
  return translate(language, `${key}.${count === 1 ? 'one' : 'other'}`, { ...params, count })
}

export { ca, en, es }
export const ALL_DICTIONARIES = DICTIONARIES
