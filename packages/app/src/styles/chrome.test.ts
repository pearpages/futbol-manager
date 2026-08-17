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

describe('the sortable column header', () => {
  it('inherits the header type, or it renders in the browser default font', () => {
    // `.data-table__sort` is a `<button>` inside a `<th>`, and a button does not
    // inherit `font` from its parent — UA stylesheets set their own. Without
    // `font: inherit` the condensed uppercase header silently becomes 13px system
    // sans, on every sortable table at once. jsdom performs no layout and the app
    // project runs `css: false`, so nothing in the suite could see it.
    const rule = ruleFor('.data-table__sort')
    expect(rule, '.data-table__sort has no rule').not.toBeNull()
    expect(rule).toMatch(/font:\s*inherit/)
    expect(rule).toMatch(/letter-spacing:\s*inherit/)
    expect(rule).toMatch(/text-transform:\s*inherit/)
  })

  it('reads as a control when pointed at, and shows which column is active', () => {
    expect(ruleFor('.data-table__sort')).toMatch(/cursor:\s*pointer/)
    expect(ruleFor('.data-table__sort.is-active')).toMatch(/var\(--fm-champion\)/)
  })

  it('left the screen it was graduated from', () => {
    // The house rule promotes a primitive on its second use, and the market's own
    // stylesheet named this move. A copy left behind is how two of them drift.
    const market = readFileSync(
      resolve(process.cwd(), 'packages/app/src/screens/MarketScreen.css'),
      'utf8',
    )
    expect(market).not.toContain('market-screen__sort')
  })
})

describe('the credit, which holds the only real link in the app', () => {
  // Read separately: this one is block-scoped rather than shared chrome, because
  // the house rule graduates a primitive on its second use and there is no second
  // link anywhere.
  const sheet = readFileSync(
    resolve(process.cwd(), 'packages/app/src/styles/shell-credit.css'),
    'utf8',
  )

  it('gives the anchor a colour, or the browser paints it its own blue', () => {
    // `.player-link` is a `<button>`; this is the app's first and only `<a>`, and
    // an anchor with no colour rule is bright blue and underlined by UA default —
    // on a near-black ground. `css: false` and jsdom's lack of layout mean nothing
    // else in the suite can see it.
    const start = sheet.indexOf('.shell__credit-link {')
    expect(start, '.shell__credit-link has no rule').toBeGreaterThan(-1)
    expect(sheet.slice(start, sheet.indexOf('}', start))).toMatch(/color:\s*var\(--fm-/)
  })

  it('inks itself for the void it sits on, not for the panel face', () => {
    // The strip is on `--fm-void`, so the panel inks are the wrong material —
    // `--fm-ink-soft` is mixed for the grey face and vanishes here, which is
    // exactly how a disabled hub tile lost its label on a coloured quadrant.
    const start = sheet.indexOf('.shell__credit {')
    expect(start, '.shell__credit has no rule').toBeGreaterThan(-1)
    const rule = sheet.slice(start, sheet.indexOf('}', start))
    expect(rule).toMatch(/color:\s*var\(--fm-screen-ink-soft\)/)
  })
})

describe('the caption under a control', () => {
  it('carries the three declarations the copies all had', () => {
    const rule = ruleFor('.hint')
    expect(rule, '.hint has no rule').not.toBeNull()
    expect(rule).toMatch(/color:\s*var\(--fm-screen-ink-soft\)/)
    expect(rule).toMatch(/font-size:\s*var\(--fm-text-xs\)/)
    expect(rule).toMatch(/line-height:\s*1\.4/)
  })

  it('left all three screens it was graduated from', () => {
    // Three names for one style, and a fourth was about to be written for the
    // explainer work. A copy left behind is how two of them drift.
    for (const [file, name] of [
      ['screens/LineupScreen.css', 'lineup-screen__hint'],
      ['screens/EstadioScreen.css', 'estadio-screen__hint'],
      ['screens/PlayerScreen.css', 'model-group__note'],
    ] as const) {
      const sheet = readFileSync(resolve(process.cwd(), `packages/app/src/${file}`), 'utf8')
      expect(sheet, file).not.toContain(name)
    }
  })

  it('leaves the two holdouts alone, because they are a different size', () => {
    // `.market-screen__hint` is a padding override on `.screen__note` and
    // `.ficha__model-note` runs at --fm-text-sm. Folding either into `.hint`
    // would be a silent restyle of a screen this change was not asked to touch.
    const market = readFileSync(
      resolve(process.cwd(), 'packages/app/src/screens/MarketScreen.css'),
      'utf8',
    )
    const ficha = readFileSync(
      resolve(process.cwd(), 'packages/app/src/screens/PlayerScreen.css'),
      'utf8',
    )
    expect(market).toContain('market-screen__hint')
    expect(ficha).toContain('ficha__model-note')
  })
})

describe('the explainer button', () => {
  it('sets its own type rather than inheriting it', () => {
    // The opposite of `.player-link` and `.data-table__sort`, on purpose: those
    // stand in for the text around them, while this is a mark that has to stay
    // the same size beside a 2rem stat and beside a caption. It sits inside
    // uppercase condensed headings, so every inherited property is named.
    const rule = ruleFor('.explain')
    expect(rule, '.explain has no rule').not.toBeNull()
    expect(rule).toMatch(/font-family:\s*var\(--fm-font\)/)
    expect(rule).toMatch(/text-transform:\s*none/)
    expect(rule).toMatch(/letter-spacing:\s*0/)
    expect(rule).toMatch(/cursor:\s*pointer/)
    expect(rule).toMatch(/border-radius:\s*50%/)
  })

  it('keeps the way out in view when the body scrolls', () => {
    // The longest topic runs to nine paragraphs and past the height of the box,
    // which left the close button below the fold. Escape and the backdrop still
    // worked; an affordance you have to go looking for is not one.
    const rule = ruleFor('.explain__actions')
    expect(rule, '.explain__actions has no rule').not.toBeNull()
    expect(rule).toMatch(/position:\s*sticky/)
    expect(rule).toMatch(/background:\s*var\(--fm-panel\)/)
  })
})

describe("a player's name as a control", () => {
  it('inherits the type it stands in for, or it renders in the browser default font', () => {
    // The same trap `.data-table__sort` documents, but across more materials: this
    // one sits in a table cell, in a bold list row and in a screen heading. Without
    // `font: inherit` all three silently become 13px system sans, and neither jsdom
    // nor the app project's `css: false` could ever see it.
    const rule = ruleFor('.player-link')
    expect(rule, '.player-link has no rule').not.toBeNull()
    expect(rule).toMatch(/font:\s*inherit/)
    expect(rule).toMatch(/color:\s*inherit/)
    // `font` is a shorthand and covers neither of these. Both screen-local copies
    // this graduated from lived in a table cell, which sets neither — so the
    // omission only surfaced when the primitive landed inside the negotiation
    // panel's `text-transform: uppercase` heading and rendered a name in mixed
    // case beside headings that were all uppercase. Found by opening the app.
    expect(rule).toMatch(/letter-spacing:\s*inherit/)
    expect(rule).toMatch(/text-transform:\s*inherit/)
  })

  it('says it is a way somewhere, without borrowing a colour to do it', () => {
    expect(ruleFor('.player-link')).toMatch(/text-decoration:\s*underline/)
    expect(ruleFor('.player-link')).toMatch(/cursor:\s*pointer/)
    expect(ruleFor('.player-link:hover')).toMatch(/var\(--fm-champion\)/)
  })

  it('left both screens it was graduated from', () => {
    // These were the same nine declarations twice over before eight call sites
    // made the duplication obvious. A copy left behind is how two of them drift.
    for (const screen of ['SquadScreen', 'MarketScreen']) {
      const sheet = readFileSync(
        resolve(process.cwd(), `packages/app/src/screens/${screen}.css`),
        'utf8',
      )
      // Named exactly. `.offer-list__name` is a live class on one of these files
      // and a legitimate one — it sets type for the row, which is the wrapper the
      // link inherits from rather than a second copy of the link.
      expect(sheet, screen).not.toContain('squad-screen__name')
      expect(sheet, screen).not.toContain('market-screen__name')
    }
  })
})
