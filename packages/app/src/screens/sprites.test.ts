import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decodeSprite,
  FIGURE_KEYS,
  FIGURES,
  INK_BY_CHAR,
  INK_KEYS,
  PART_BY_CHAR,
  SPRITES,
  type InkKey,
  type PartKey,
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

/**
 * Runs expanded back into a grid, which is how the merge gets proved.
 *
 * The character is reconstructed from the ink *and the part*, so this still
 * compares byte-for-byte against the authored grid rather than against some
 * normalised copy of it — the round trip covers the part split as well as the
 * merge. **The part has to come first:** `i`, `m` and `u` all draw in `ink`, so
 * reversing `INK_BY_CHAR` alone collides and silently answers `u` for all three.
 */
function expand(figure: keyof typeof FIGURES): string[] {
  const { width, height, parts } = FIGURES[figure]
  const charFor = new Map<InkKey, string>(
    Object.entries(INK_BY_CHAR)
      .filter(([char]) => PART_BY_CHAR[char] === undefined)
      .map(([char, ink]) => [ink, char]),
  )
  const charForPart = new Map<PartKey, string>(
    Object.entries(PART_BY_CHAR).map(([char, part]) => [part, char]),
  )
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'))

  for (const { part, inks } of parts) {
    for (const { ink, runs } of inks) {
      const lower = charForPart.get(part) ?? (charFor.get(ink) as string)
      const char = part === 'prop' ? lower.toUpperCase() : lower
      for (const run of runs) {
        for (let i = 0; i < run.w; i += 1) grid[run.y]![run.x + i] = char
      }
    }
  }
  return grid.map((row) => row.join(''))
}

/** Every run a figure draws, flattened, tagged with the group it came from. */
function allRuns(figure: keyof typeof FIGURES) {
  return FIGURES[figure].parts.flatMap(({ part, inks }) =>
    inks.flatMap(({ ink, runs }) => runs.map((run) => ({ part, ink, run }))),
  )
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
      const ink = INK_BY_CHAR[char.toLowerCase()]
      expect(ink, `${key} uses '${char}', which is not an ink`).toBeDefined()
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
    for (const { run } of allRuns(key)) {
      for (let i = 0; i < run.w; i += 1) {
        const at = `${run.x + i},${run.y}`
        expect(seen.has(at), `${key} paints ${at} twice`).toBe(false)
        seen.add(at)
      }
    }
  })

  it('really does merge, so the round-trip is proving something', () => {
    // Guard on the guard. One rect per pixel would round-trip perfectly and mean
    // the merge was never exercised at all — that is the claim, and the divisor
    // is only a comfortable distance from it.
    //
    // Measured at 438 rects to 1,297 pixels, so 2.96×. It was 422 before the two
    // expressions arrived: `ssummus` breaks a face row into five runs where
    // `sssiiss` took three, and the same again on the row below. Interleaving is
    // what keeps mouth and smile from overlapping, so the cost is the design
    // rather than a regression — but a *big* move here is worth looking at.
    const rects = FIGURE_KEYS.reduce((n, key) => n + allRuns(key).length, 0)
    const pixels = FIGURE_KEYS.reduce(
      (n, key) => n + SPRITES[key].join('').replaceAll('.', '').length,
      0,
    )
    expect(rects).toBeLessThan(pixels / 2.5)
  })

  it('drops characters it does not recognise', () => {
    expect(decodeSprite(['?x?']).parts).toEqual([])
  })

  it('never merges a prop pixel into the body run beside it', () => {
    // The property the whole part split rests on: runs merge across identical
    // characters, and `a` is not `A`. If case were folded before merging, a prop
    // would silently rejoin the body and nothing else here would notice.
    const { parts } = decodeSprite(['aaAA'])
    expect(parts.map(({ part, inks }) => [part, inks.map(({ runs }) => runs)])).toEqual([
      ['body', [[{ x: 0, y: 0, w: 2 }]]],
      ['prop', [[{ x: 2, y: 0, w: 2 }]]],
    ])
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
    const drawn = new Set<InkKey>(FIGURE_KEYS.flatMap((key) => allRuns(key).map(({ ink }) => ink)))
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

describe('every figure carries a prop', () => {
  it.each(FIGURE_KEYS)('%s is drawn in four addressable pieces', (key) => {
    // The hover moves `prop` and swaps `mouth` for `smile`. A figure decoded
    // into one part would still render perfectly and simply never react.
    const parts = FIGURES[key].parts.map(({ part }) => part)
    expect(parts).toEqual(['body', 'mouth', 'smile', 'prop'])
  })

  it.each(FIGURE_KEYS)('%s keeps its prop off the body', (key) => {
    // Every prop is held out at the right — the leftmost is the agent's contract
    // at column 18 — while the two neckties sit at columns 12–14. So this is the
    // guard that fails if a grid edit ever upper-cases a tie: the pixel that
    // moves would be one a man is wearing.
    for (const { part, run } of allRuns(key)) {
      if (part !== 'prop') continue
      expect(run.x, `${key} moves a pixel at column ${run.x}`).toBeGreaterThanOrEqual(18)
    }
  })

  it.each(['agent', 'director'] as const)('%s keeps his tie out of the prop', (key) => {
    // Both suits draw a tie *and* a prop detail in `accent`, so the ink cannot
    // separate them and the part must. Stated directly because it is the defect
    // the whole design exists to prevent — though the column rule above is the
    // stronger of the two: checked by hand, this one only fires when the *whole*
    // tie moves, while that one fires on a single stray pixel.
    const accent = FIGURES[key].parts.filter(({ inks }) => inks.some((it) => it.ink === 'accent'))
    expect(accent.map(({ part }) => part)).toEqual(['body', 'prop'])
  })
})

describe('every figure has two expressions', () => {
  /** Rows and columns the head occupies. Everything below is a shirt. */
  const FACE = { top: 2, bottom: 9, left: 10, right: 16 }

  function rowsOf(key: (typeof FIGURE_KEYS)[number], part: PartKey): number[] {
    return allRuns(key)
      .filter((it) => it.part === part)
      .map(({ run }) => run.y)
  }

  it.each(FIGURE_KEYS)('%s keeps both mouths on his face', (key) => {
    // The counterpart of the prop's column-18 rule, and it does the same job:
    // an `m` or a `u` typed onto a shirt would draw a dark smudge that appears
    // out of nowhere on hover. It also catches an upper-case `M` or `U`, which
    // resolves to `prop` and so lands far outside this box.
    for (const { part, run } of allRuns(key)) {
      if (part !== 'mouth' && part !== 'smile') continue
      const where = `${key} draws ${part} at ${run.x},${run.y}`
      expect(run.y, where).toBeGreaterThanOrEqual(FACE.top)
      expect(run.y, where).toBeLessThanOrEqual(FACE.bottom)
      expect(run.x, where).toBeGreaterThanOrEqual(FACE.left)
      expect(run.x + run.w - 1, where).toBeLessThanOrEqual(FACE.right)
    }
  })

  it.each(FIGURE_KEYS)('%s smiles rather than frowns', (key) => {
    // What makes the shape read as a smile is that its corners sit on the
    // mouth's own row and its curve one row below. Drawn the other way up it is
    // a frown, which no other guard here could tell apart — both are four ink
    // pixels on a face.
    const mouth = new Set(rowsOf(key, 'mouth'))
    const smile = new Set(rowsOf(key, 'smile'))
    expect([...mouth], `${key}'s mouth spans more than one row`).toHaveLength(1)
    const [row] = [...mouth] as [number]
    const spans = [...smile].sort((a, b) => a - b)
    expect(spans, `${key}'s smile is not a curve under its corners`).toEqual([row, row + 1])
  })
})

describe('hovering a section wakes the figure up', () => {
  // Comments stripped first. The note above these rules explains what a *looping*
  // animation would have needed — `animation: none` under reduced motion — and
  // that sentence is picked up as a declaration otherwise. Exactly how the hub's
  // `nth-of-type` guard first failed: a comment naming the thing it describes.
  const rules = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')

  /** Every `@keyframes` in the file, brace-matched so nested blocks survive. */
  function keyframes(): Map<string, string> {
    const found = new Map<string, string>()
    for (const match of rules.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      let depth = 1
      let i = (match.index as number) + match[0].length
      const from = i
      while (depth > 0 && i < rules.length) {
        if (rules[i] === '{') depth += 1
        if (rules[i] === '}') depth -= 1
        i += 1
      }
      found.set(match[1] as string, rules.slice(from, i - 1))
    }
    return found
  }

  const used = new Set([...rules.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1] as string))

  it.each(FIGURE_KEYS)('%s animates on hover and on focus', (key) => {
    for (const trigger of ['hover', 'focus-within']) {
      const selector = `.hub__quadrant:${trigger} .hub-figure[data-figure='${key}'] [data-part='prop']`
      expect(rules, `${key} does not animate on :${trigger}`).toContain(selector)
    }
  })

  it('hides the smile until you look', () => {
    // Both mouths are drawn on every face and exactly one is shown. Without this
    // rule a figure grins permanently, with the resting mouth on top of it.
    const start = rules.indexOf(`.hub-figure [data-part='smile']`)
    expect(start, 'nothing hides the smile at rest').toBeGreaterThan(-1)
    expect(rules.slice(start, rules.indexOf('}', start))).toContain('opacity: 0')
  })

  it.each(['hover', 'focus-within'])('swaps the two mouths on :%s', (trigger) => {
    // The value matters as much as the selector, and asserting only the latter
    // is how this very file shipped a `:hover` rule setting the smile back to
    // `opacity: 0` — every selector present, and nobody ever smiling.
    for (const [part, shown] of [
      ['mouth', '0'],
      ['smile', '1'],
    ] as const) {
      const selector = `.hub__quadrant:${trigger} .hub-figure [data-part='${part}']`
      const start = rules.indexOf(selector)
      expect(start, `${part} is not swapped on :${trigger}`).toBeGreaterThan(-1)
      const block = rules.slice(rules.indexOf('{', start), rules.indexOf('}', start))
      expect(block, `${part} is not set to opacity ${shown} on :${trigger}`).toContain(
        `opacity: ${shown}`,
      )
    }
  })

  it('names no animation it does not define', () => {
    // The same shape as "declares no ink the sprites do not draw": a typo in an
    // animation name is silent, and the figure simply never moves.
    const defined = keyframes()
    for (const name of used) {
      expect(defined.has(name), `${name} is used but never defined`).toBe(true)
    }
  })

  it('defines no animation nobody uses', () => {
    for (const name of keyframes().keys()) {
      expect(used.has(name), `${name} is defined but nothing plays it`).toBe(true)
    }
  })

  it('moves the prop and repaints nothing', () => {
    // Colour lives in the palettes above and motion must not become a second way
    // to set it. A keyframe that touched `fill` would put a colour value outside
    // the block this file's whole arrangement keeps it in.
    for (const [name, block] of keyframes()) {
      const properties = [...block.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])
      expect([...new Set(properties)], `${name} declares more than transform`).toEqual([
        'transform',
      ])
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
