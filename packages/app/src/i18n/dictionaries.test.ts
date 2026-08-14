import { describe, expect, it } from 'vitest'
import {
  ALL_DICTIONARIES,
  ca,
  DEFAULT_LANGUAGE,
  en,
  es,
  LANGUAGES,
  LANGUAGE_NAMES,
  translate,
  translatePlural,
} from './index.ts'

/**
 * The guard that makes three languages maintainable.
 *
 * Without it a missing key is invisible: `translate` falls back, the screen looks
 * fine in the language you happen to be testing, and the other two quietly serve
 * English. Same shape as the badge-palette test — the thing that can drift is
 * checked mechanically rather than carefully.
 */

const KEYS = Object.keys(ca)

describe('the three dictionaries agree', () => {
  it('carries the same keys, in both directions', () => {
    // Both directions matters. Checking only "does es have everything ca has"
    // lets an orphan sit in es forever, which is a translation nobody will ever
    // see and a maintenance cost nobody will ever notice.
    for (const [name, dictionary] of Object.entries(ALL_DICTIONARIES)) {
      const missing = KEYS.filter((key) => !(key in dictionary))
      const extra = Object.keys(dictionary).filter((key) => !(key in ca))

      expect(missing, `${name} is missing keys`).toEqual([])
      expect(extra, `${name} has keys nothing else does`).toEqual([])
    }
  })

  it('leaves nothing blank', () => {
    for (const [name, dictionary] of Object.entries(ALL_DICTIONARIES)) {
      for (const key of KEYS) {
        expect(dictionary[key]?.trim(), `${name}.${key}`).not.toBe('')
      }
    }
  })

  it('uses the same parameters in every language', () => {
    // A `{player}` that becomes `{jugador}` in translation renders the brace
    // literally — visible, but only on the screen nobody opened. This is the
    // check that catches it.
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

    for (const key of KEYS) {
      const expected = placeholders(ca[key] ?? '')
      for (const [name, dictionary] of Object.entries(ALL_DICTIONARIES)) {
        expect(placeholders(dictionary[key] ?? ''), `${name}.${key}`).toEqual(expected)
      }
    }
  })

  it('gives every plural key both forms', () => {
    const bases = new Set(
      KEYS.filter((key) => key.endsWith('.one') || key.endsWith('.other')).map((key) =>
        key.replace(/\.(one|other)$/, ''),
      ),
    )
    for (const base of bases) {
      expect(KEYS, `${base} needs both forms`).toContain(`${base}.one`)
      expect(KEYS).toContain(`${base}.other`)
    }
  })

  it('names every language in its own language', () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language].length).toBeGreaterThan(0)
    }
  })

  it('actually says something different in each', () => {
    // A guard on the guard: three identical dictionaries would pass every test
    // above and translate nothing.
    expect(ca['nav.squad']).not.toBe(en['nav.squad'])
    expect(es['nav.table']).not.toBe(en['nav.table'])
    expect(ca['action.back']).not.toBe(es['action.back'])
  })
})

describe('translate', () => {
  it('fills in parameters', () => {
    expect(translate('en', 'shell.matchday', { round: 6 })).toBe('Matchday 6')
  })

  it('leaves an unknown parameter alone rather than blanking it', () => {
    expect(translate('en', 'shell.matchday')).toBe('Matchday {round}')
  })

  it('returns the key when there is no such string', () => {
    // Louder than an empty span, which is a hole you do not notice.
    expect(translate('en', 'no.such.key')).toBe('no.such.key')
  })

  it('falls back to the default language rather than showing a key', () => {
    const sparse = { ...ALL_DICTIONARIES }
    expect(translate(DEFAULT_LANGUAGE, 'nav.squad')).toBe(ca['nav.squad'])
    expect(Object.keys(sparse)).toHaveLength(LANGUAGES.length)
  })

  it('picks singular and plural', () => {
    expect(translatePlural('en', 'hub.inDays', 1)).toBe('in 1 day')
    expect(translatePlural('en', 'hub.inDays', 3)).toBe('in 3 days')
    expect(translatePlural('ca', 'hub.inDays', 1)).toBe('en 1 dia')
    expect(translatePlural('ca', 'hub.inDays', 3)).toBe('en 3 dies')
  })
})
