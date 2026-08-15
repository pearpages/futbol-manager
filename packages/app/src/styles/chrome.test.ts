import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Assertions about the shared chrome that only the stylesheet can answer.
 *
 * jsdom performs no layout and the app project runs with `css: false`, so nothing
 * in the suite can see that a bar failed to paint. This reads the file instead —
 * the idiom `badges.test.ts` documents, for the same reason: what can drift is
 * checked mechanically rather than carefully.
 */

// `import.meta.url` is not a file URL under vite-node, so resolve from the root.
const css = readFileSync(resolve(process.cwd(), 'packages/app/src/styles/chrome.css'), 'utf8')

/** The declaration block for a selector, or `null` if there is no such rule. */
function ruleFor(selector: string): string | null {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return null
  return css.slice(start, css.indexOf('}', start))
}

describe('the attribute bar actually paints', () => {
  it('gives the fill a display, because width does not apply to an inline box', () => {
    // The bug this exists for: `.attr__fill` is a `<span>`, and CSS ignores both
    // `width` and `height` on a non-replaced inline box. All 21 `data-fill` rules
    // and the `height: 100%` were computed and discarded from M3b until 2026-08-15,
    // on the ficha and on the stadium gauge alike, and no test could see it.
    const fill = ruleFor('.attr__fill')
    expect(fill, '.attr__fill has no rule').not.toBeNull()
    expect(fill).toMatch(/display:\s*(block|flex|inline-block)/)
  })

  it('keeps the track a grid item, which is what gives it a height', () => {
    // `.attr__track` declares no display of its own and gets blockified only by
    // being a child of a grid. Take the grid away and the trough collapses too.
    expect(ruleFor('.attr')).toMatch(/display:\s*grid/)
  })

  it('covers every bucket the markup can produce', () => {
    // `Math.round(value / 5)` over 1–99 and `fillFor` both yield 0–20 inclusive.
    for (let bucket = 0; bucket <= 20; bucket++) {
      expect(css, `data-fill='${String(bucket)}'`).toContain(
        `.attr__fill[data-fill='${String(bucket)}']`,
      )
    }
  })
})
