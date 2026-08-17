/**
 * Reading a pixel-art text grid.
 *
 * `sprites.ts` has held this scan since the hub figures landed, as the first half
 * of `decodeSprite`. The trophies are the second caller, which is the point at
 * which this project generalises (ground rule 5) — and the half worth sharing is
 * not the grouping, which differs (a figure groups by part *and* ink, a trophy by
 * ink alone), but the scan, which is identical and is the subtle part.
 *
 * ## Merging is case-sensitive, and that is load-bearing
 *
 * `sprites.ts` uses case as a second axis: `a` is an accent pixel of a figure's
 * body, `A` the same accent inside the prop he carries. Two runs may only merge
 * when the characters are *equal*, so a prop can never silently rejoin the body
 * beside it — which is what lets the hub slide a clipboard without dragging a
 * necktie along with it.
 *
 * **Only a synthetic grid can prove that.** No real grid in this codebase places a
 * prop pixel horizontally adjacent to a body pixel of the same ink, so folding
 * case here would break nothing visible and nothing else in the suite — see the
 * `['aaAA']` case in `pixels.test.ts`, which is the one test that fails for it.
 *
 * Geometry only. No colour lives here, in `sprites.ts` or in `trophies.ts` — it is
 * in the stylesheets, the split `badges.ts` and `radar.ts` established.
 */

/** A horizontal run of one character. `w` pixels wide, one pixel tall. */
export interface PixelRun {
  readonly char: string
  readonly x: number
  readonly y: number
  readonly w: number
}

/**
 * Walks a grid of characters into horizontal runs, left to right, top to bottom.
 *
 * Every character is a run — deciding which ones mean something, and what, is the
 * caller's vocabulary. Runs are emitted in reading order, so a caller that groups
 * them keeps a stable order without sorting.
 */
export function scanRuns(rows: readonly string[]): PixelRun[] {
  const runs: PixelRun[] = []

  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const char = row[x] as string
      let w = 1
      // Strict equality, never a case-fold — see the note above.
      while (row[x + w] === char) w += 1
      runs.push({ char, x, y, w })
      x += w
    }
  })

  return runs
}

/** The grid's dimensions, taken from the first row. */
export function gridSize(rows: readonly string[]): { width: number; height: number } {
  return { width: rows[0]?.length ?? 0, height: rows.length }
}
