import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decodeTrophy,
  TROPHIES,
  TROPHY_GRIDS,
  TROPHY_INK_KEYS,
  TROPHY_KEYS,
  type TrophyInk,
} from './trophies.ts'

/**
 * The trophies.
 *
 * Modelled on `sprites.test.ts` / `badges.test.ts`, and for the same reason:
 * geometry lives in TS and colour in CSS, so the two can drift and the result
 * renders as something unpolished rather than something broken — a trophy with an
 * unfilled hole where an ink was never given a value.
 *
 * Resolved from the repo root rather than `import.meta.url`: under vite-node that
 * is not a file URL and `readFileSync` refuses it.
 */

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const css = read('packages/app/src/styles/trophies.css')
const source = read('packages/app/src/screens/trophies.ts')

/** Every run of every ink in one trophy. */
const allRuns = (key: (typeof TROPHY_KEYS)[number]) => TROPHIES[key].inks

describe('decodeTrophy', () => {
  it('groups runs by ink', () => {
    expect(decodeTrophy(['mmll']).inks).toEqual([
      { ink: 'metal', runs: [{ x: 0, y: 0, w: 2 }] },
      { ink: 'sheen', runs: [{ x: 2, y: 0, w: 2 }] },
    ])
  })

  it('emits inks in TROPHY_INK_KEYS order, not the order the grid draws them', () => {
    // So the markup does not depend on which pixel a grid happens to reach first.
    expect(decodeTrophy(['ipm']).inks.map(({ ink }) => ink)).toEqual(['metal', 'plinth', 'ink'])
  })

  it('drops characters it does not recognise', () => {
    expect(decodeTrophy(['..?..']).inks).toEqual([])
  })

  it('reads the grid size off the rows', () => {
    expect(decodeTrophy(['mmmm', 'mmmm'])).toMatchObject({ width: 4, height: 2 })
  })
})

describe('every trophy grid', () => {
  it.each(TROPHY_KEYS)('%s is rectangular', (key) => {
    // A ragged row would put pixels outside the viewBox, which silently clips.
    const rows = TROPHY_GRIDS[key]
    const width = rows[0]?.length ?? 0
    for (const [y, row] of rows.entries()) {
      expect(row.length, `row ${y} is ${row.length}, not ${width}`).toBe(width)
    }
    expect(TROPHIES[key].width).toBe(width)
    expect(TROPHIES[key].height).toBe(rows.length)
  })

  it.each(TROPHY_KEYS)('%s round-trips back to its grid', (key) => {
    const rows = TROPHY_GRIDS[key]
    const canvas = rows.map(() => Array.from({ length: rows[0]?.length ?? 0 }, () => '.'))
    for (const { ink, runs } of allRuns(key)) {
      for (const { x, y, w } of runs) {
        for (let i = 0; i < w; i++) {
          const row = canvas[y]
          if (row !== undefined) row[x + i] = charFor(ink)
        }
      }
    }
    expect(canvas.map((row) => row.join(''))).toEqual([...rows])
  })

  it.each(TROPHY_KEYS)('%s merges runs rather than emitting one rect per pixel', (key) => {
    // Guard on the guard: the round trip above passes perfectly with no merging at
    // all, so it proves nothing about the thing merging exists for.
    const pixels = TROPHY_GRIDS[key].join('').replaceAll('.', '').length
    const rects = allRuns(key).reduce((n, { runs }) => n + runs.length, 0)
    expect(rects).toBeLessThan(pixels / 2.5)
  })
})

describe('the league trophy reads as a cup', () => {
  const rows = TROPHY_GRIDS.league

  it('keeps daylight through both handles', () => {
    // The single most fragile thing in the drawing, and filling it is *silent* — a
    // solid block still looks like something, just not like a handle. The handles
    // attach at the flared lip and rejoin the bowl, so the gap is what makes the
    // eye read a loop rather than a wing.
    for (const y of [4, 5, 6]) {
      const row = rows[y] ?? ''
      expect(row[2], `left handle gap filled at row ${y}`).toBe('.')
      expect(row[13], `right handle gap filled at row ${y}`).toBe('.')
    }
  })

  it('is wider than it is thick at the rim and narrower at the stem', () => {
    // The taper *is* the cup. A grid that lost it would still pass every guard
    // above while looking like a pillar.
    const filled = (y: number) => [...(rows[y] ?? '')].filter((c) => c !== '.').length
    expect(filled(1)).toBeGreaterThan(filled(10))
    expect(filled(10)).toBe(2)
  })

  it('stands on a plinth wider than its stem', () => {
    const inks = new Set(allRuns('league').map(({ ink }) => ink))
    expect(inks.has('plinth')).toBe(true)
    const plinthRow = [...(rows[16] ?? '')].filter((c) => c === 'p').length
    expect(plinthRow).toBeGreaterThan(2)
  })
})

describe('every ink has a colour', () => {
  it.each(TROPHY_INK_KEYS)('%s is declared and filled in the stylesheet', (ink) => {
    expect(css, `no --trophy-${ink}`).toContain(`--trophy-${ink}`)
    expect(css, `nothing fills ${ink}`).toContain(`[data-ink='${ink}']`)
  })

  it('declares no ink the trophies do not draw', () => {
    const drawn = new Set<TrophyInk>(TROPHY_KEYS.flatMap((key) => allRuns(key).map((i) => i.ink)))
    for (const match of css.matchAll(/\[data-ink='(\w+)'\]/g)) {
      const ink = match[1] as TrophyInk
      expect(drawn.has(ink), `${ink} is painted but never drawn`).toBe(true)
    }
  })

  it.each(TROPHY_KEYS)('%s declares its two base colours', (key) => {
    const rule = css.match(new RegExp(`\\[data-trophy='${key}'\\][^}]+}`))?.[0] ?? ''
    expect(rule, `no palette block for ${key}`).not.toBe('')
    expect(rule).toContain('--trophy-metal')
    expect(rule).toContain('--trophy-plinth')
  })

  it('derives the sheen and the shade rather than picking them', () => {
    // The badge rim's lesson: hand-chosen neighbours look fine and are wrong. Both
    // must be mixed from a colour that is already right.
    for (const derived of ['--trophy-sheen', '--trophy-shade']) {
      const value = css.match(new RegExp(`${derived}:([^;]+);`))?.[1] ?? ''
      expect(value, `${derived} is not derived`).toContain('color-mix')
      expect(value, `${derived} does not read the metal`).toContain('var(--trophy-metal)')
    }
  })

  it('keeps every colour out of the TypeScript', () => {
    // The split the whole file rests on. A hex here is the drift starting.
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('the size rule', () => {
  it('offers no small variant to reach for', () => {
    // 5rem over 20 rows is four device pixels a row, which is what makes this read
    // as pixel art. At a badge's 1.25rem it would be one, and the handles, the
    // sheen and the stem would all vanish — so a trophy never goes in a table row,
    // and the stylesheet deliberately gives nobody an `is-sm` to try it with.
    expect(css).not.toContain('.trophy.is-sm')
    expect(css).toContain('height: 5rem')
  })
})

/** The character an ink is drawn with — the inverse of `TROPHY_INK_BY_CHAR`. */
function charFor(ink: TrophyInk): string {
  const chars: Readonly<Record<TrophyInk, string>> = {
    metal: 'm',
    sheen: 'l',
    shade: 'h',
    plinth: 'p',
    ink: 'i',
  }
  return chars[ink]
}
