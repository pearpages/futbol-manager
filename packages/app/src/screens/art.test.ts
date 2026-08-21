import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIGURE_KEYS } from './HubFigure.tsx'
import { TROPHY_KEYS } from './TrophyIcon.tsx'
import { STADIUM_ART, seatsKey } from './stadium.ts'

/**
 * The shipped art, as files.
 *
 * **This is what replaces the pixel guards.** Those tests asserted things about
 * character grids — that a figure round-tripped, that no stadium module overlapped
 * another, that a row had not collapsed into a checker — and all of it went when
 * the drawings became painted box art (ADR 0012). None of it can be asserted about
 * a raster.
 *
 * What can: that every file a component asks for is actually on disk, and that the
 * set stays inside a weight budget. A missing file is invisible in jsdom — the app
 * project runs `css: false` and never loads an image — so a typo in a `src` renders
 * a broken image in the real browser and a perfectly green suite.
 */

const ART = resolve(process.cwd(), 'packages/app/public/art')
const sizeOf = (p: string) => statSync(resolve(ART, p)).size
const KB = 1024

describe('the shipped art', () => {
  it('has a file for every hub figure', () => {
    for (const figure of FIGURE_KEYS) {
      expect(() => sizeOf(`${figure}.webp`), figure).not.toThrow()
    }
  })

  it('has a file for every trophy', () => {
    // One competition so far; the cup and the supercup are M7's. The file is named
    // for the key, so adding a competition fails here until its drawing lands.
    for (const trophy of TROPHY_KEYS) {
      expect(() => sizeOf(`${trophy}.webp`), trophy).not.toThrow()
    }
  })

  it('has a drawing for every ground it declares, and declares every drawing', () => {
    // **Set equality, not a count.** The old version asserted the directory held
    // exactly `TOP_TIER` files, which a stray file and a stray declaration could
    // cancel out between them. This catches either alone.
    //
    // Deliberately non-recursive, and the `.webp` filter is what keeps it that way:
    // `stadium/small/` holds four village grounds that are parked rather than
    // declared, and a recursive walk would fail this for no reason.
    const onDisk = readdirSync(resolve(ART, 'stadium')).filter((f) => f.endsWith('.webp'))
    expect([...onDisk].sort()).toEqual([...declaredFiles()].sort())
  })

  it('names every drawing for a whole number of thousands of seats', () => {
    // The filename *is* the capacity, so it has to parse back to one. A rung of
    // 24_500 would render `24.5k.webp`, which no rename would ever have produced.
    for (const rung of STADIUM_ART) {
      expect(rung.seats % 1000, `${String(rung.seats)} seats`).toBe(0)
      expect(seatsKey(rung.seats)).toMatch(/^\d+k$/)
    }
    const seats = STADIUM_ART.map((r) => r.seats)
    expect([...seats], 'the ladder is not ascending').toEqual([...seats].sort((a, b) => a - b))
    expect(new Set(seats).size, 'two rungs claim the same capacity').toBe(seats.length)
  })

  it('keeps first paint cheap, which is the budget that actually matters', () => {
    // **Per screen, not per set.** The fifty-six grounds are ~1.7 MB on disk and
    // that figure is misleading: a career only ever fetches the one drawing its
    // club has earned, because the ghosted "what you could build" preview went with
    // the pixel modules. So the number to hold down is the largest single drawing.
    //
    // The `.webp` filter is not cosmetic — `stadium/small/` is a directory, and
    // `statSync` answers for one rather than throwing.
    const biggest = Math.max(
      ...readdirSync(resolve(ART, 'stadium'))
        .filter((f) => f.endsWith('.webp'))
        .map((f) => sizeOf(`stadium/${f}`)),
    )
    expect(biggest).toBeLessThan(140 * KB)

    // The hub pays for all four figures at once — they are on screen together.
    const hub = FIGURE_KEYS.reduce((n, f) => n + sizeOf(`${f}.webp`), 0)
    expect(hub).toBeLessThan(120 * KB)
  })

  it('draws the cut-outs against alpha rather than a background block', () => {
    // Every one of these sits on a panel, not in a box of its own. WebP stores
    // alpha in a dedicated chunk and flags it in the VP8X header, so that bit is
    // the cheap structural check that the chroma key actually ran — a fully opaque
    // export keyed nothing and would show a magenta rectangle on the panel.
    for (const figure of FIGURE_KEYS) expect(hasAlpha(`${figure}.webp`), figure).toBe(true)
    for (const trophy of TROPHY_KEYS) expect(hasAlpha(`${trophy}.webp`), trophy).toBe(true)
    for (const file of declaredFiles()) expect(hasAlpha(`stadium/${file}`), file).toBe(true)
  })
})

/**
 * Every file the ladder says exists: a base per rung, plus one lettered sibling per
 * declared variant. Derived rather than listed, so the declaration is the only
 * place a drawing is named.
 */
function declaredFiles(): readonly string[] {
  return STADIUM_ART.flatMap((rung) =>
    Array.from(
      { length: rung.variants + 1 },
      (_, i) => `${seatsKey(rung.seats)}${i === 0 ? '' : String.fromCharCode(96 + i)}.webp`,
    ),
  )
}

/** VP8X extended-format header: bit 4 of the flags byte is the alpha flag. */
function hasAlpha(name: string): boolean {
  const buf = readFileSync(resolve(ART, name))
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return false
  if (buf.toString('ascii', 12, 16) !== 'VP8X') return false
  return (buf[20]! & 0b0001_0000) !== 0
}
