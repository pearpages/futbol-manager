import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CLUBS } from '@fm/data'
import { BADGES, badgeFor, COLOUR_KEYS, needsNameplate } from './badges.ts'

/**
 * The badge table, checked without rendering.
 *
 * The point of the file under test is that twenty clubs must be tellable apart
 * at a glance, so that is what these assert.
 */

describe('every club has a badge', () => {
  it('covers the whole league', () => {
    // Adding a twenty-first club should fail here rather than render blank.
    for (const club of DEFAULT_CLUBS) {
      expect(BADGES[club.id], club.id).toBeDefined()
    }
  })

  it('has no entries for clubs that do not exist', () => {
    const ids = new Set(DEFAULT_CLUBS.map((c) => c.id))
    for (const id of Object.keys(BADGES)) {
      expect(ids.has(id as (typeof DEFAULT_CLUBS)[number]['id']), id).toBe(true)
    }
  })

  it('falls back rather than throwing on an unknown club', () => {
    expect(badgeFor('nowhere')).toBeDefined()
  })
})

describe('no two clubs look the same', () => {
  it('never repeats a colours + pattern + shape triple', () => {
    // This is the whole reason shapes exist. Following real kits puts five clubs
    // on red-and-white stripes; without a different shape each, a twenty-row
    // table has five identical marks in it.
    const seen = new Map<string, string>()

    for (const club of DEFAULT_CLUBS) {
      const badge = badgeFor(club.id)
      const key = `${badge.colours}/${badge.pattern}/${badge.shape}`
      const clash = seen.get(key)
      expect(clash, `${club.id} is indistinguishable from ${clash ?? ''} (${key})`).toBeUndefined()
      seen.set(key, club.id)
    }
  })

  it('really does share colours — otherwise shapes are doing nothing', () => {
    // A guard on the guard: if every club had its own palette the uniqueness
    // test above would pass trivially and prove nothing.
    const palettes = DEFAULT_CLUBS.map((c) => badgeFor(c.id).colours)
    expect(new Set(palettes).size).toBeLessThan(DEFAULT_CLUBS.length)
  })

  it('gives the clubs sharing a palette different shapes', () => {
    const byPalette = new Map<string, string[]>()
    for (const club of DEFAULT_CLUBS) {
      const badge = badgeFor(club.id)
      const shapes = byPalette.get(badge.colours) ?? []
      shapes.push(`${badge.pattern}/${badge.shape}`)
      byPalette.set(badge.colours, shapes)
    }

    for (const [palette, marks] of byPalette) {
      expect(new Set(marks).size, palette).toBe(marks.length)
    }
  })
})

describe('the palettes are declared', () => {
  it('only names schemes club-badges.css defines a rule for', () => {
    // A typo'd key renders an unstyled badge — ugly rather than obviously broken,
    // which is exactly the kind of thing that ships.
    const declared = new Set<string>(COLOUR_KEYS)
    for (const club of DEFAULT_CLUBS) {
      expect(declared.has(badgeFor(club.id).colours), club.id).toBe(true)
    }
  })

  it('declares none it does not use', () => {
    const used = new Set(DEFAULT_CLUBS.map((c) => badgeFor(c.id).colours))
    for (const key of COLOUR_KEYS) {
      expect(used.has(key), `${key} is declared but unused`).toBe(true)
    }
  })
})

describe('every palette is fully declared in CSS', () => {
  // Geometry lives in TS and colour in CSS, which is what keeps colour values out
  // of components — but it also means a palette can be *named* here and never
  // *defined* there, and the result renders as a badge with no fill and an
  // invisible rim. That looks unpolished rather than broken, which is exactly the
  // kind of thing that ships.
  // Resolved from the repo root rather than `import.meta.url`: under vite-node
  // that is not a file URL, and `readFileSync` refuses it.
  const css = readFileSync(
    resolve(process.cwd(), 'packages/app/src/styles/club-badges.css'),
    'utf8',
  )

  const PROPERTIES = ['--badge-a', '--badge-b', '--badge-ink'] as const

  /** The declaration block for one palette, or `null` if there is no rule. */
  function ruleFor(key: string): string | null {
    const start = css.indexOf(`.club-badge[data-colours='${key}']`)
    if (start < 0) return null
    return css.slice(start, css.indexOf('}', start))
  }

  it.each(COLOUR_KEYS)('%s declares its three colours', (key) => {
    const rule = ruleFor(key)
    expect(rule, `no rule for ${key}`).not.toBeNull()
    for (const property of PROPERTIES) {
      expect(rule, `${key} is missing ${property}`).toContain(property)
    }
  })

  it('gives every badge a rim by default', () => {
    // The rim is not declared per palette any more — it falls out of the club's
    // own second colour, which is what keeps it on-palette without anyone
    // choosing thirteen values by hand.
    const base = css.slice(
      css.indexOf('\n.club-badge {'),
      css.indexOf('}', css.indexOf('\n.club-badge {')),
    )
    expect(base).toContain('--badge-rim: var(--badge-b)')
  })

  it('never paints the rim a colour the club does not own', () => {
    // The rule this file exists to protect. Six palettes once carried invented
    // near-white tints, picked to get contrast — they looked fine and were not
    // the club's colours. A literal hex here is exactly that drift returning;
    // an override must point at another badge token.
    for (const key of COLOUR_KEYS) {
      const rule = ruleFor(key) ?? ''
      const rim = /--badge-rim:\s*([^;]+);/.exec(rule)?.[1]?.trim()
      if (rim === undefined) continue // inherits the default, which is on-palette

      expect(rim, `${key} hard-codes a rim colour`).toMatch(/^var\(--badge-(b|ink)\)$/)
    }
  })
})

describe('legibility', () => {
  it('puts a nameplate behind the code on the busy patterns', () => {
    // Stripes and hoops run straight through three letters at row size.
    expect(needsNameplate('stripes')).toBe(true)
    expect(needsNameplate('hoops')).toBe(true)
    expect(needsNameplate('sash')).toBe(true)
    expect(needsNameplate('solid')).toBe(false)
    expect(needsNameplate('halves')).toBe(false)
  })
})
