import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decodeSprite,
  FIGURE_KEYS,
  FIGURES,
  INK_BY_CHAR,
  INK_KEYS,
  SPRITES,
  type InkKey,
} from './sprites.ts'

/**
 * The hub's four figures.
 *
 * Modelled on `badges.test.ts`, because it is the same shape of problem: geometry
 * lives in TS and colour in CSS, so the two can drift apart and the result
 * renders as something unpolished rather than something broken — a figure with an
 * unfilled hole where an ink was never given a value.
 *
 * Resolved from the repo root rather than `import.meta.url`: under vite-node that
 * is not a file URL and `readFileSync` refuses it.
 */

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const css = read('packages/app/src/styles/hub-figures.css')

/** The first declaration block for one figure, or `null` if there is none. */
function ruleFor(key: string): string | null {
  const start = css.indexOf(`.hub-figure[data-figure='${key}']`)
  if (start < 0) return null
  return css.slice(start, css.indexOf('}', start))
}

/** Runs expanded back into a grid, which is how the merge gets proved. */
function expand(figure: keyof typeof FIGURES): string[] {
  const { width, height, runs } = FIGURES[figure]
  const charFor = new Map<InkKey, string>(
    Object.entries(INK_BY_CHAR).map(([char, ink]) => [ink, char]),
  )
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'))

  for (const [ink, list] of runs) {
    const char = charFor.get(ink)
    for (const run of list) {
      for (let i = 0; i < run.w; i += 1) grid[run.y]![run.x + i] = char as string
    }
  }
  return grid.map((row) => row.join(''))
}

describe('the grids are well formed', () => {
  it.each(FIGURE_KEYS)('%s is a rectangle', (key) => {
    // A ragged row shifts every pixel after it by one and reads as a figure that
    // has been sheared. Cheap to typo, invisible to review.
    const rows = SPRITES[key]
    const widths = new Set(rows.map((row) => row.length))
    expect(widths.size, `ragged rows: ${[...widths].join(', ')}`).toBe(1)
  })

  it.each(FIGURE_KEYS)('%s draws only characters the ink table knows', (key) => {
    // `decodeSprite` skips an unknown character rather than throwing, so this is
    // the guard that stops a typo becoming a silent hole in a figure.
    for (const char of new Set(SPRITES[key].join(''))) {
      if (char === '.') continue
      expect(INK_BY_CHAR[char], `${key} uses '${char}', which is not an ink`).toBeDefined()
    }
  })

  it('draws every figure on the same skeleton', () => {
    // They sit in a row along the bottom of four panels. Different heights would
    // read as four unrelated drawings rather than as a set.
    const sizes = new Set(FIGURE_KEYS.map((key) => `${FIGURES[key].width}x${FIGURES[key].height}`))
    expect([...sizes]).toEqual(['28x32'])
  })
})

describe('decoding a grid', () => {
  it.each(FIGURE_KEYS)('%s round-trips through the run merge', (key) => {
    // The property that makes merging safe to optimise later: whatever the
    // decoder emits must re-expand to exactly the grid that was authored.
    expect(expand(key)).toEqual([...SPRITES[key]])
  })

  it.each(FIGURE_KEYS)('%s never claims a pixel twice', (key) => {
    // Why the render order in `decodeSprite` is free to be INK_KEYS order rather
    // than insertion order: no two groups overlap, so nothing is painted over
    // anything else and layering cannot matter.
    const seen = new Set<string>()
    for (const [, list] of FIGURES[key].runs) {
      for (const run of list) {
        for (let i = 0; i < run.w; i += 1) {
          const at = `${run.x + i},${run.y}`
          expect(seen.has(at), `${key} paints ${at} twice`).toBe(false)
          seen.add(at)
        }
      }
    }
  })

  it('really does merge, so the round-trip is proving something', () => {
    // Guard on the guard. One rect per pixel would round-trip perfectly and mean
    // the merge was never exercised at all.
    const rects = FIGURE_KEYS.reduce(
      (n, key) => n + FIGURES[key].runs.reduce((m, [, list]) => m + list.length, 0),
      0,
    )
    const pixels = FIGURE_KEYS.reduce(
      (n, key) => n + SPRITES[key].join('').replaceAll('.', '').length,
      0,
    )
    expect(rects).toBeLessThan(pixels / 3)
  })

  it('drops characters it does not recognise', () => {
    expect(decodeSprite(['?x?']).runs).toEqual([])
  })
})

describe('every ink has a colour', () => {
  it.each(INK_KEYS)('%s is declared in the stylesheet', (ink) => {
    // Colour lives in CSS and geometry in TS, so an ink can be *drawn* in one and
    // never *defined* in the other. That renders as an unfilled shape.
    expect(css, `no --sprite-${ink}`).toContain(`--sprite-${ink}`)
    expect(css, `nothing fills ${ink}`).toContain(`[data-ink='${ink}']`)
  })

  it('declares no ink the sprites do not draw', () => {
    const drawn = new Set<InkKey>(
      FIGURE_KEYS.flatMap((key) => FIGURES[key].runs.map(([ink]) => ink)),
    )
    for (const match of css.matchAll(/\[data-ink='(\w+)'\]/g)) {
      const ink = match[1] as InkKey
      expect(drawn.has(ink), `${ink} is painted but never drawn`).toBe(true)
    }
  })
})

describe('every figure has a palette', () => {
  // The five a figure chooses. `shade` and `seam` are deliberately absent —
  // they are mixed from skin and garment on `.hub-figure`, never picked here.
  const CHOSEN = ['hair', 'skin', 'garment', 'trouser', 'light', 'accent'] as const

  it.each(FIGURE_KEYS)('%s declares its own colours', (key) => {
    const rule = ruleFor(key)
    expect(rule, `no rule for ${key}`).not.toBeNull()
    for (const ink of CHOSEN) {
      expect(rule, `${key} is missing --sprite-${ink}`).toContain(`--sprite-${ink}:`)
    }
  })

  it('declares none the hub does not use', () => {
    const used = new Set<string>(FIGURE_KEYS)
    for (const match of css.matchAll(/\[data-figure='(\w+)'\]/g)) {
      const key = match[1] as string
      expect(used.has(key), `${key} is painted but nobody wears it`).toBe(true)
    }
  })

  it('gives no two figures the same clothes', () => {
    // Two of the four are suited. Palette is most of what separates them, so a
    // copy-paste that left both on one garment colour would be hard to spot.
    const garments = FIGURE_KEYS.map(
      (key) => /--sprite-garment:\s*([^;]+);/.exec(ruleFor(key) ?? '')?.[1],
    )
    expect(new Set(garments).size).toBe(FIGURE_KEYS.length)
  })

  it('mixes the shading rather than picking it', () => {
    // The rule this file exists to protect, and the lesson the badge rim already
    // paid for: six hand-chosen neutrals looked fine and were wrong. A shade must
    // point at a colour that is already correct.
    const base = css.slice(
      css.indexOf('.hub-figure {'),
      css.indexOf('}', css.indexOf('.hub-figure {')),
    )
    for (const derived of ['shade', 'seam']) {
      const value = new RegExp(`--sprite-${derived}:\\s*([^;]+);`).exec(base)?.[1]
      expect(value, `--sprite-${derived} is not declared on .hub-figure`).toBeDefined()
      expect(value, `--sprite-${derived} hard-codes a colour`).toContain('var(--sprite-')
    }
  })
})

describe('the split holds', () => {
  it('keeps every colour value out of the TypeScript', () => {
    // Same claim `radar.test.ts` makes about its two files. Kept here rather than
    // appended to that list because a guard belongs beside what it guards.
    for (const path of [
      'packages/app/src/screens/sprites.ts',
      'packages/app/src/screens/HubFigure.tsx',
    ]) {
      expect(read(path), path).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})
