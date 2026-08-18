import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COVER,
  COVER_CENTRE,
  COVER_GRID,
  COVER_INK_BY_CHAR,
  COVER_INK_KEYS,
  COVER_PITCH_ROWS,
  decodeCover,
} from './cover.ts'

/**
 * Guards for the landing page's cover.
 *
 * The first block is the set every art module in this project carries. The second
 * is specific to this one, and exists because none of the first can tell a picture
 * from a smear — the stadium shipped a draft whose top stand was nineteen blank
 * rows and another whose seventh tier read as a running track, and both passed
 * every structural test there was.
 *
 * Paths are from the repo root: under vite-node `import.meta.url` is not a file
 * URL and `readFileSync` refuses it. Same dodge `stadium.test.ts` uses.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const SOURCE = read('packages/app/src/screens/cover.ts')
const COMPONENT = read('packages/app/src/screens/CoverArt.tsx')
const CSS_RAW = read('packages/app/src/styles/cover.css')
/* Comments stripped before every selector or declaration scan. This project has
   twice had a test read the comment explaining a rule as the rule itself. */
const CSS = CSS_RAW.replaceAll(/\/\*[\s\S]*?\*\//g, '')

const WIDTH = COVER_GRID[0]?.length ?? 0
const HEIGHT = COVER_GRID.length
const cellAt = (x: number, y: number) => COVER_GRID[y]?.[x]

function runsIn(row: string): number {
  let n = 1
  for (let i = 1; i < row.length; i++) if (row[i] !== row[i - 1]) n += 1
  return n
}

describe('the cover grid', () => {
  it('is rectangular', () => {
    for (const [i, row] of COVER_GRID.entries()) expect(row.length, `row ${i}`).toBe(WIDTH)
  })

  it('is odd in both axes, so the centre is a pixel and not a seam', () => {
    // The same claim `stadium-plan.ts` makes, for the same reason: the view is
    // symmetric about the goal, and a halfway line sitting half a pixel off centre
    // is visible at this size.
    expect(WIDTH % 2).toBe(1)
    expect(HEIGHT % 2).toBe(1)
    expect(COVER_CENTRE).toBe((WIDTH - 1) / 2)
  })

  it('uses only characters the ink table knows', () => {
    for (const [y, row] of COVER_GRID.entries())
      for (const [x, char] of [...row].entries())
        expect(COVER_INK_BY_CHAR[char], `(${x}, ${y}) is '${char}'`).toBeDefined()
  })

  it('round-trips: expanding the runs gives back exactly what was authored', () => {
    const back: string[][] = COVER_GRID.map(() => Array<string>(WIDTH).fill('?'))
    const charOf = new Map(Object.entries(COVER_INK_BY_CHAR).map(([c, ink]) => [ink, c]))
    for (const { ink, runs } of COVER.inks)
      for (const run of runs)
        for (let i = 0; i < run.w; i++) back[run.y]![run.x + i] = charOf.get(ink) as string
    expect(back.map((r) => r.join(''))).toEqual([...COVER_GRID])
  })

  it('merges into runs rather than a rect per pixel', () => {
    // Guard on the guard: one rect per pixel would round-trip perfectly above and
    // prove nothing. Measured 10.46x; the divisor leaves room to re-tune the art
    // and still catches a texture collapsing into a checker, which would land near
    // 2x. A checker is why every band of texture here is horizontal runs.
    const rects = COVER.inks.reduce((n, i) => n + i.runs.length, 0)
    expect(rects).toBeLessThan((WIDTH * HEIGHT) / 6)
  })

  it('skips characters it does not know rather than throwing', () => {
    expect(decodeCover(['yy?y']).inks.flatMap((i) => i.runs)).toHaveLength(2)
  })
})

describe('the cover palette', () => {
  const DERIVED: Readonly<Record<string, string>> = {
    glow: 'lamp',
    haze: 'lamp',
    stripe: 'turf',
    shade: 'crowd',
    dusk: 'turf',
    seam: 'roof',
  }

  it('declares and fills every ink, and paints none it never draws', () => {
    const drawn = new Set(COVER.inks.map((i) => i.ink))
    for (const ink of COVER_INK_KEYS) {
      expect(CSS, `--cover-${ink}`).toContain(`--cover-${ink}:`)
      expect(CSS, `fill for ${ink}`).toContain(`.cover [data-ink='${ink}']`)
      expect(drawn.has(ink), `${ink} is declared but never drawn`).toBe(true)
    }
    for (const match of CSS.matchAll(/\[data-ink='([a-z]+)'\]/g))
      expect(COVER_INK_KEYS as readonly string[]).toContain(match[1])
  })

  it('scopes every fill rule, because six of these ink names are not ours alone', () => {
    // `seam`, `shade`, `turf`, `stripe`, `line` and `roof` are all names
    // `stadium.css` uses too, and `shade`/`seam` are `hub-figures.css`'s as well.
    // A bare `[data-ink='seam']` here would repaint both of those — and paint
    // nothing itself, since `--cover-*` exists only inside this element.
    for (const match of CSS.matchAll(/(^|[},]\s*)(\[data-ink=)/gm))
      expect.fail(`unscoped fill rule: ${match[0].trim()}`)
    expect(CSS).toContain(".cover [data-ink='seam']")
  })

  it('mixes every shadow and highlight from a colour it names, never toward black', () => {
    // The habit that most separates competent pixel art from good: a shadow takes
    // the ambient hue and a highlight takes the source hue. Mixing with `#000`
    // gives a muddy neutral, and it is what every other module in this app does.
    for (const [ink, base] of Object.entries(DERIVED)) {
      const rule = CSS.match(new RegExp(`--cover-${ink}:([^;]+);`))?.[1] ?? ''
      expect(rule, ink).toContain('color-mix')
      expect(rule, `${ink} names its base`).toContain(`var(--cover-${base})`)
      expect(rule, `${ink} darkens toward a colour, not toward black`).not.toMatch(/#[0-9a-f]/i)
    }
  })

  it('takes no club colours, because it renders before a club exists', () => {
    // The landing page is what you see with no career. `badgeFor` has nothing to
    // give it, so unlike `stadium.css` this palette is entirely its own.
    expect(CSS).not.toContain('var(--badge-')
    expect(CSS).not.toContain('data-colours')
  })

  it('keeps colour out of the TypeScript', () => {
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(COMPONENT).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('is sized on one dimension, and steps down twice on viewport height', () => {
    // Width only, with the viewBox supplying the ratio, so it can never letterbox.
    // Deliberately larger than the house four-device-pixels-per-art-pixel the
    // other modules hold: those are ornaments inside a screen and this is the
    // screen. At the house figure it sat in the middle of a 1440-wide page with a
    // third of its column empty and read as an afterthought.
    expect(CSS).toContain('max-width: 64rem')
    // **Height** queries — the only ones in this app. The stadium steps on width
    // because its constraint is horizontal; this competes for viewport height with
    // the copy and the two doors under it. Both figures are measured, and the
    // first one was wrong at 58rem: a 900px window is 56.25rem, so it fired on the
    // commonest desktop size there is.
    expect(CSS).toMatch(/@media \(height < 50rem\)/)
    expect(CSS).toContain('max-width: 48rem')
    expect(CSS).toMatch(/@media \(height < 42rem\)/)
    expect(CSS).toContain('max-width: 34rem')
    expect(CSS).not.toContain('.cover.is-sm')
  })
})

describe('the cover reads as a picture', () => {
  it('is full bleed — there is no hole anywhere in it', () => {
    // Unique to this module. A gap would show near-black `--fm-void` through the
    // sky and read as a dead pixel, which is also why the sky is a drawn ink
    // rather than a CSS background behind a sparser grid.
    for (const [i, row] of COVER_GRID.entries()) expect(row.includes('.'), `row ${i}`).toBe(false)
  })

  it('never repeats a row more than a few times over', () => {
    // The stadium's two worst drafts, written down: nineteen consecutive blank
    // rows in one, and a tier that read as a single slab of concrete in the other.
    // Neither was visible in source. Measured 5.
    let run = 1
    let worst = { run: 1, at: 0 }
    for (let y = 1; y < HEIGHT; y++) {
      run = COVER_GRID[y] === COVER_GRID[y - 1] ? run + 1 : 1
      if (run > worst.run) worst = { run, at: y }
    }
    expect(worst.run, `${worst.run} identical rows ending at ${worst.at}`).toBeLessThanOrEqual(6)
  })

  it('has no row that has collapsed into a checker', () => {
    // The merge ratio above is an average and a single band can go bad underneath
    // it. This is the guard the stadium's own notes say it wished it had had.
    // Measured 50, on the busiest row of the wordmark.
    const worst = Math.max(...COVER_GRID.map(runsIn))
    expect(worst).toBeLessThan(62)
  })

  it('stays inside a first-paint budget', () => {
    // The stadium pair ships 1,441 rects and is the known-acceptable figure. This
    // one lands on first paint with nothing else on the screen. Measured 1,401.
    expect(COVER.inks.reduce((n, i) => n + i.runs.length, 0)).toBeLessThan(1800)
  })

  it('draws the pitch markings symmetrically about the centre column', () => {
    // The odd-axes claim with teeth. A pitch drawn one column off centre is
    // invisible in source and obvious on screen, and no other test here could see
    // it — every structural guard passes on a drawing that is simply wrong.
    //
    // Markings only. The crowd and the manager are deliberately *not* mirrored,
    // because a mirrored crowd looks mechanical — and where he or a player stands
    // in front of a line, the line is occluded rather than missing.
    const OCCLUDES = new Set(['f', 'i', 'k'])
    for (let y = COVER_PITCH_ROWS.top; y <= COVER_PITCH_ROWS.bottom; y++)
      for (let x = 0; x < WIDTH; x++) {
        if (cellAt(x, y) !== 'w') continue
        const opposite = cellAt(WIDTH - 1 - x, y) as string
        expect(
          opposite === 'w' || OCCLUDES.has(opposite),
          `line at (${x}, ${y}) has '${opposite}' opposite it`,
        ).toBe(true)
      }
  })

  it('uses every ink in a quantity somebody could see', () => {
    // Catches an ink that dissolved to a handful of stray pixels in a re-tune,
    // which the declared/filled/drawn check above would still pass. Measured 52,
    // on the rim light down the manager's lit edge.
    const counts = new Map<string, number>()
    for (const row of COVER_GRID)
      for (const char of row) counts.set(char, (counts.get(char) ?? 0) + 1)
    for (const [char, ink] of Object.entries(COVER_INK_BY_CHAR))
      expect(counts.get(char) ?? 0, `${ink} is barely drawn`).toBeGreaterThan(30)
  })
})
