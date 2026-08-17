import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CLUBS } from '@fm/data'
import { COLOUR_KEYS } from './badges.ts'
import { PLAN_MODULES } from './stadium-plan.ts'
import { SECTION_MODULES } from './stadium-section.ts'
import {
  decodeStadium,
  ghostDepth,
  STADIUM_INK_BY_CHAR,
  STADIUM_INK_KEYS,
  STADIUM_TIERS,
  type StadiumInk,
  type StadiumModule,
  stadiumTierFor,
  type StadiumTier,
  TOP_TIER,
} from './stadium.ts'

/**
 * The ground.
 *
 * Modelled on `trophies.test.ts` / `sprites.test.ts`, and for the same reason:
 * geometry lives in TS and colour in CSS, so the two can drift and the result
 * renders as something unpolished rather than something broken.
 *
 * Resolved from the repo root rather than `import.meta.url`: under vite-node that
 * is not a file URL and `readFileSync` refuses it.
 */

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const css = read('packages/app/src/styles/stadium.css')
const badgeCss = read('packages/app/src/styles/club-badges.css')
const sources = [
  'packages/app/src/screens/stadium.ts',
  'packages/app/src/screens/stadium-plan.ts',
  'packages/app/src/screens/stadium-section.ts',
  'packages/app/src/screens/StadiumView.tsx',
]

const TIERS: readonly StadiumTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const VIEWS = [
  ['plan', PLAN_MODULES],
  ['section', SECTION_MODULES],
] as const

/** The characters that make up the pitch — the part that must never move. */
const PITCH_CHARS = new Set(['g', 's', 'w'])

/** Every drawn cell of a module, as "x,y" keys. */
function cellsOf(module: StadiumModule): Map<string, string> {
  const cells = new Map<string, string>()
  module.grid.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      if (ch !== '.') cells.set(`${String(x)},${String(y)}`, ch)
    })
  })
  return cells
}

/** Everything visible at a tier, as one map — what the screen actually shows. */
function builtAt(modules: readonly StadiumModule[], tier: StadiumTier): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of modules) {
    if (m.tier > tier) continue
    for (const [at, ch] of cellsOf(m)) out.set(at, ch)
  }
  return out
}

describe('decodeStadium', () => {
  it('groups runs by ink', () => {
    expect(decodeStadium(['nnll']).inks).toEqual([
      { ink: 'lit', runs: [{ x: 2, y: 0, w: 2 }] },
      { ink: 'mid', runs: [{ x: 0, y: 0, w: 2 }] },
    ])
  })

  it('emits inks in STADIUM_INK_KEYS order, not the order the grid draws them', () => {
    // So the markup does not depend on which pixel a grid happens to reach first.
    expect(decodeStadium(['gnr']).inks.map(({ ink }) => ink)).toEqual(['roof', 'mid', 'turf'])
  })

  it('drops characters it does not recognise', () => {
    expect(decodeStadium(['..?..']).inks).toEqual([])
  })

  it('reads the grid size off the rows', () => {
    expect(decodeStadium(['nnnn', 'nnnn'])).toMatchObject({ width: 4, height: 2 })
  })
})

describe.each(VIEWS)('every %s module', (view, modules) => {
  it('is rectangular and the same size as its siblings', () => {
    // A ragged row would put pixels outside the viewBox, which silently clips —
    // and two modules of different sizes could not be composited at all.
    const sizes = new Set<string>()
    for (const m of modules) {
      const width = m.grid[0]?.length ?? 0
      for (const [y, row] of m.grid.entries()) {
        expect(row.length, `${view}/${m.key} row ${String(y)}`).toBe(width)
      }
      sizes.add(`${String(width)}x${String(m.grid.length)}`)
    }
    expect(sizes.size, `${view} modules disagree on size`).toBe(1)
  })

  it('is odd in both axes, so the drawing is symmetric about a real pixel', () => {
    const first = modules[0]
    /* c8 ignore next */
    if (first === undefined) throw new Error('no modules')
    expect((first.grid[0]?.length ?? 0) % 2).toBe(1)
    expect(first.grid.length % 2).toBe(1)
  })

  it('draws no cell another module draws', () => {
    // The guard the whole architecture rests on. Paint order is free only while
    // this holds, and — the part that actually matters — a ghost drawn over
    // something already built would make a finished ground look unfinished.
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const m of modules) {
      for (const at of cellsOf(m).keys()) {
        const already = owner.get(at)
        if (already !== undefined) clashes.push(`${at}: ${already} and ${m.key}`)
        else owner.set(at, m.key)
      }
    }
    expect(clashes.slice(0, 5)).toEqual([])
  })

  it('draws only characters the ink table knows', () => {
    const unknown = new Set<string>()
    for (const m of modules) {
      for (const ch of cellsOf(m).values()) {
        if (STADIUM_INK_BY_CHAR[ch] === undefined) unknown.add(ch)
      }
    }
    expect([...unknown]).toEqual([])
  })

  it('round-trips back to its grid', () => {
    for (const m of modules) {
      const width = m.grid[0]?.length ?? 0
      const canvas = m.grid.map(() => Array.from({ length: width }, () => '.'))
      for (const { ink, runs } of decodeStadium(m.grid).inks) {
        for (const { x, y, w } of runs) {
          for (let i = 0; i < w; i++) {
            const row = canvas[y]
            if (row !== undefined) row[x + i] = charFor(ink)
          }
        }
      }
      expect(
        canvas.map((row) => row.join('')),
        m.key,
      ).toEqual([...m.grid])
    }
  })

  it('merges runs rather than emitting one rect per pixel', () => {
    // Guard on the guard: the round trip above passes perfectly with no merging
    // at all, so it proves nothing about the thing merging exists for.
    //
    // Asserted across the view rather than per module, because run-merging is
    // horizontal and some modules are inherently vertical — the section's back
    // wall is one column, so every cell of it is its own run and always will be.
    // Measured: plan 3.69x, section 1.90x, 1,441 rects for the pair on screen.
    //
    // The plan's seating is banded by row rather than checkered precisely so it
    // still merges; a checker would make every run one pixel wide.
    const pixels = modules.reduce((n, m) => n + cellsOf(m).size, 0)
    const rects = modules.reduce(
      (n, m) => n + decodeStadium(m.grid).inks.reduce((k, { runs }) => k + runs.length, 0),
      0,
    )
    expect(rects, `${view} barely merges`).toBeLessThan(pixels / 1.6)
  })

  it('claims a tier that exists, and never repeats one', () => {
    const tiers = modules.map((m) => m.tier)
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
    expect(new Set(tiers).size).toBe(tiers.length)
    for (const t of tiers) expect(t).toBeLessThanOrEqual(TOP_TIER)
  })
})

describe('the twelve tiers are one ground getting bigger', () => {
  it('gives every tier something to show in at least one view', () => {
    // Otherwise a step on the ladder costs money and changes nothing on screen.
    // Not *both* views: the corner and end infills are invisible in a section.
    const claimed = new Set([...PLAN_MODULES, ...SECTION_MODULES].map((m) => m.tier))
    expect([...claimed].sort((a, b) => a - b)).toEqual([...TIERS])
  })

  it('draws the pitch once, and never touches it again', () => {
    // A pitch is 105x68 everywhere in the world, and holding it fixed is what
    // makes the eye read the ground growing rather than the picture zooming.
    //
    // The first version of this compared the pitch at every tier against tier 1
    // and **passed with the pitch deliberately broken** — the pitch lives
    // entirely in the tier-1 module and every tier includes tier 1, so it was
    // true by construction. The claim that bites is that nothing built later
    // draws turf, a marking or a mown band: the moment a module does, the pitch
    // changes shape as you build.
    for (const [view, modules] of VIEWS) {
      let pitchCells = 0
      for (const m of modules) {
        const pitch = [...cellsOf(m).values()].filter((ch) => PITCH_CHARS.has(ch)).length
        if (m.tier === 1) pitchCells = pitch
        else expect(pitch, `${view}/${m.key} redraws the pitch`).toBe(0)
      }
      expect(pitchCells, `${view} draws no pitch at all`).toBeGreaterThan(20)
    }
  })

  it('adds built area at every step', () => {
    const built = TIERS.map(
      (tier) => builtAt(PLAN_MODULES, tier).size + builtAt(SECTION_MODULES, tier).size,
    )
    for (let i = 1; i < built.length; i++) {
      expect(built[i], `tier ${String(i + 1)} is no bigger than tier ${String(i)}`).toBeGreaterThan(
        built[i - 1] as number,
      )
    }
  })

  it('grows the plan footprint in both axes', () => {
    const footprint = (tier: StadiumTier) => {
      const xs: number[] = []
      const ys: number[] = []
      for (const at of builtAt(PLAN_MODULES, tier).keys()) {
        const [x, y] = at.split(',').map(Number)
        xs.push(x as number)
        ys.push(y as number)
      }
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    }

    // Not every tier widens the plan — some are corner infills, and some are
    // section-only. The claim is that the first and last differ in both axes and
    // that it never shrinks.
    const sizes = TIERS.map(footprint)
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]?.w).toBeGreaterThanOrEqual(sizes[i - 1]?.w ?? 0)
      expect(sizes[i]?.h).toBeGreaterThanOrEqual(sizes[i - 1]?.h ?? 0)
    }
    expect(sizes.at(-1)?.w).toBeGreaterThan((sizes[0]?.w ?? 0) + 10)
    expect(sizes.at(-1)?.h).toBeGreaterThan((sizes[0]?.h ?? 0) + 10)
  })

  it('builds the section upwards', () => {
    // The section exists because the plan cannot show height, so this is the
    // claim it has to keep: the stand's highest point rises as tiers do.
    const highest = (tier: StadiumTier) =>
      Math.min(...[...builtAt(SECTION_MODULES, tier).keys()].map((at) => Number(at.split(',')[1])))

    const tops = TIERS.map(highest)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i], `tier ${String(i + 1)} stands taller than it should not`).toBeLessThanOrEqual(
        tops[i - 1] as number,
      )
    }
    expect(tops.at(-1)).toBeLessThan((tops[0] as number) - 15)
  })
})

describe('stadiumTierFor', () => {
  it('puts a capacity on the low side of every threshold', () => {
    // Exact boundaries: the threshold itself belongs to the tier below it.
    STADIUM_TIERS.forEach((threshold, i) => {
      expect(stadiumTierFor(threshold), `${String(threshold)} exactly`).toBe(i + 1)
      expect(stadiumTierFor(threshold + 1), `${String(threshold)} + 1`).toBe(i + 2)
    })
  })

  it('keeps the shipped league inside the first seven tiers', () => {
    // The thresholds below 105,000 are the ones the seven-tier version shipped
    // with, so nobody's ground changed when the ladder grew.
    const byTier = new Map<StadiumTier, string[]>()
    for (const club of DEFAULT_CLUBS) {
      const tier = stadiumTierFor(club.capacity)
      byTier.set(tier, [...(byTier.get(tier) ?? []), club.name])
    }
    for (const tier of [1, 2, 3, 4, 5, 6, 7] as StadiumTier[]) {
      expect(byTier.get(tier), `nobody is on tier ${String(tier)}`).not.toBeUndefined()
    }
    for (const tier of [8, 9, 10, 11, 12] as StadiumTier[]) {
      expect(byTier.get(tier), `tier ${String(tier)} should be unbuilt`).toBeUndefined()
    }
    expect(stadiumTierFor(14_708)).toBe(1) // Vallecas, the smallest ground
    expect(stadiumTierFor(105_000)).toBe(7) // Barcelona, the largest
  })

  it('runs all the way to 200,000 and then stops', () => {
    expect(stadiumTierFor(200_000)).toBe(11)
    expect(stadiumTierFor(200_001)).toBe(TOP_TIER)
    expect(stadiumTierFor(Number.MAX_SAFE_INTEGER)).toBe(TOP_TIER)
  })

  it('clamps rather than throwing on a capacity below the floor', () => {
    expect(stadiumTierFor(0)).toBe(1)
    expect(stadiumTierFor(Number.NaN)).toBe(1)
  })
})

describe('ghostDepth', () => {
  it('says nothing about anything already built', () => {
    // `null` is what the view keys on, so a built module carries no attribute and
    // full strength is the default rather than a rule.
    expect(ghostDepth(1, 5)).toBeNull()
    expect(ghostDepth(5, 5)).toBeNull()
  })

  it('fades with distance', () => {
    expect(ghostDepth(2, 1)).toBe('next')
    expect(ghostDepth(4, 1)).toBe('soon')
    expect(ghostDepth(7, 1)).toBe('far')
    expect(ghostDepth(12, 1)).toBe('distant')
  })

  it('brightens as the tier rises beneath it', () => {
    const seen = [1, 5, 6, 9, 11].map((tier) => ghostDepth(12, tier as StadiumTier))
    expect(seen).toEqual(['distant', 'distant', 'far', 'soon', 'next'])
  })
})

describe('every ink has a colour', () => {
  it.each(STADIUM_INK_KEYS)('%s is declared and filled in the stylesheet', (ink) => {
    expect(css, `no --stadium-${ink}`).toContain(`--stadium-${ink}`)
    expect(css, `nothing fills ${ink}`).toContain(`[data-ink='${ink}']`)
  })

  it('declares no ink the drawings do not use', () => {
    const drawn = new Set<string>()
    for (const [, modules] of VIEWS) {
      for (const m of modules) {
        for (const ch of cellsOf(m).values()) drawn.add(STADIUM_INK_BY_CHAR[ch] as string)
      }
    }
    for (const match of css.matchAll(/\[data-ink='(\w+)'\]/g)) {
      expect(
        drawn.has(match[1] as string),
        `${match[1] as string} is painted but never drawn`,
      ).toBe(true)
    }
  })

  it('derives every shade rather than picking it', () => {
    // The badge rim's lesson: hand-chosen neighbours look fine and are wrong.
    for (const [derived, base] of [
      ['--stadium-lit', 'var(--stadium-seat)'],
      ['--stadium-shade', 'var(--stadium-seat)'],
      ['--stadium-seam', 'var(--stadium-seat)'],
      ['--stadium-apron', 'var(--stadium-concrete)'],
      ['--stadium-stripe', 'var(--stadium-turf)'],
    ] as const) {
      const value = css.match(new RegExp(`${derived}:([^;]+);`))?.[1] ?? ''
      expect(value, `${derived} is not derived`).toContain('color-mix')
      expect(value, `${derived} does not read its base`).toContain(base)
    }
  })

  it('takes the seats from the club palette rather than inventing a colour', () => {
    const seat = css.match(/--stadium-seat:([^;]+);/)?.[1] ?? ''
    expect(seat, 'the seats are not the club colour').toContain('var(--badge-a')
    // Mixed toward the concrete, never raw: `white` and `yellow` would otherwise
    // put a glaring blob on the near-black screen.
    expect(seat).toContain('color-mix')
    expect(seat).toContain('var(--stadium-concrete)')
  })

  it.each(COLOUR_KEYS)('resolves the %s palette for the stadium too', (palette) => {
    expect(badgeCss).toContain(`.stadium[data-colours='${palette}']`)
  })

  it('keeps every colour out of the TypeScript', () => {
    // The split the whole thing rests on. A hex in any of them is drift starting.
    for (const path of sources) {
      expect(read(path), path).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})

describe('the size rule', () => {
  it('offers no small variant to reach for', () => {
    // 49 rows at 12.25rem is four device pixels a row, the ratio that already
    // makes the hub figures and the trophy read as pixel art. Shrunk to a badge's
    // size the decks, the gangways and the roofs collapse into a smear.
    expect(css).not.toContain('.stadium.is-sm')
    expect(css).toContain('height: 12.25rem')
  })

  it('steps down where the screen stacks, and only there', () => {
    // Below 60rem the drawings stop sharing a row with the works panel and start
    // pushing it down the page. Both sizes are pinned because both were measured.
    expect(css).toContain('@media (width < 60rem)')
    expect(css).toContain('height: 9.5rem')
  })

  it('lays the two views out in one row at one scale', () => {
    // The section's grid is the same height as the plan's precisely so a single
    // CSS height renders both at the same pixel size. Stacking them would break
    // that and lose the point of showing them together.
    const pair = css.match(/\.stadium-pair \{[^}]+\}/)?.[0] ?? ''
    expect(pair).toContain('display: flex')
    const planRows = PLAN_MODULES[0]?.grid.length
    expect(SECTION_MODULES[0]?.grid.length).toBe(planRows)
  })
})

/** The character an ink is drawn with — the inverse of `STADIUM_INK_BY_CHAR`. */
function charFor(ink: StadiumInk): string {
  const found = Object.entries(STADIUM_INK_BY_CHAR).find(([, value]) => value === ink)
  /* c8 ignore next */
  if (found === undefined) throw new Error(`no character draws ${ink}`)
  return found[0]
}
