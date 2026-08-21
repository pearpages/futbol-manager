import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DEFAULT_CLUBS } from '@fm/data'
import { App } from '../App.tsx'
import { useGame } from '../store.ts'
import { translatorFor } from '../i18n/useT.ts'
import { QUADRANTS } from './HubScreen.tsx'
import { FIGURE_KEYS } from './HubFigure.tsx'
import { ICON_KEYS } from './TileIcon.tsx'

/**
 * The hub's four sections: a colour each, an icon per tile.
 *
 * Modelled on `badges.test.ts`, because it is the same shape of problem —
 * geometry lives in TS and colour in CSS, so the two can drift apart and the
 * result renders as something unpolished rather than something broken.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MID)
})

const { t } = translatorFor('en')
const TILES = QUADRANTS.flatMap((quadrant) => quadrant.tiles)

describe('every tile has an icon', () => {
  it('names one the icon set defines', () => {
    // A thirteenth tile should fail here rather than render a blank square.
    const declared = new Set<string>(ICON_KEYS)
    for (const tile of TILES) {
      expect(declared.has(tile.icon), tile.key).toBe(true)
    }
  })

  it('declares none the hub does not use', () => {
    const used = new Set(TILES.map((tile) => tile.icon))
    for (const key of ICON_KEYS) {
      expect(used.has(key), `${key} is drawn but unused`).toBe(true)
    }
  })

  it('gives every tile its own, so no two say the same thing', () => {
    const used = TILES.map((tile) => tile.icon)
    expect(new Set(used).size).toBe(used.length)
  })

  it('renders one per tile, and none of them speak', () => {
    // The whole reason these are aria-hidden: two dozen assertions across five
    // files find a tile by its exact accessible name, and an icon that
    // contributed text would rename every one of them.
    render(<App />)
    const icons = [...document.querySelectorAll('.hub__tile .tile-icon')]

    expect(icons).toHaveLength(TILES.length)
    for (const icon of icons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('every section has its figure', () => {
  it('stands one at the foot of each quadrant, and none of them speak', () => {
    // Same reason the tile icons are hidden: two dozen assertions across five
    // files find a tile by its exact accessible name. A figure sits outside the
    // button so it could not rename one — this is what proves it did not.
    render(<App />)

    for (const { key, figure } of QUADRANTS) {
      const section = document.querySelector(`.hub__quadrant[data-quadrant='${key}']`)
      const art = section?.querySelector('.hub-figure')
      expect(art, `${key} has no figure`).not.toBeNull()
      expect(art?.getAttribute('data-figure')).toBe(figure)
      expect(art?.getAttribute('aria-hidden')).toBe('true')
    }
    expect(document.querySelectorAll('.hub-figure')).toHaveLength(QUADRANTS.length)
  })

  it('paints each figure from its own file, cut out against alpha', () => {
    // Replaces the prop-group guard. There is no prop to animate any more — a
    // painting is one image — so what is worth pinning is that the four are
    // distinct files and none has silently fallen back to a shared one.
    render(<App />)

    const sources = QUADRANTS.map(({ key }) => {
      const art = document.querySelector(`.hub__quadrant[data-quadrant='${key}'] .hub-figure`)
      expect(art, `${key} has no figure`).not.toBeNull()
      // Decorative: the empty `alt` is what stops a reader announcing the file name.
      expect(art?.getAttribute('alt'), key).toBe('')
      return art?.getAttribute('src') ?? ''
    })

    expect(new Set(sources).size, 'two quadrants share a figure').toBe(QUADRANTS.length)
    for (const src of sources) expect(src).toMatch(/^\/art\/[a-z]+\.webp$/)
  })

  it('gives every section its own, so no two hire the same person', () => {
    const cast = QUADRANTS.map((quadrant) => quadrant.figure)
    expect(new Set(cast).size).toBe(cast.length)
  })

  it('draws one the sprite set defines', () => {
    // A fifth quadrant should fail here rather than render an empty box.
    const declared = new Set<string>(FIGURE_KEYS)
    for (const { key, figure } of QUADRANTS) {
      expect(declared.has(figure), key).toBe(true)
    }
  })
})

describe('the Entrenador quadrant', () => {
  const entrenador = QUADRANTS.find((q) => q.key === 'entrenador')
  if (entrenador === undefined) throw new Error('no Entrenador quadrant')

  it('sends one tile to the lineup screen, not two', () => {
    // Alineació and Tàctiques both pointed at `lineup` until the two were
    // merged. The screen holds the shape *and* the eleven, which is what the
    // reference does, so a second tile was a second label for one place — and
    // an untested one: nothing ever clicked it.
    const live = entrenador.tiles.filter((tile) => tile.to !== null)

    expect(entrenador.tiles).toHaveLength(3)
    expect(live.map((tile) => tile.key)).toEqual(['nav.lineup'])
  })

  it('promises training for M6, disabled', () => {
    // The slot the merge freed. The hub doubles as a roadmap you can see, and
    // training was the one milestone item the roadmap assigns that it had
    // never named.
    render(<App />)
    const tile = screen.getByRole('button', { name: `${t('nav.training')}M6` })

    expect(tile.hasAttribute('disabled')).toBe(true)
    expect(tile.getAttribute('title')).toMatch(/M6/)
  })
})

describe('the tiles are still findable by name', () => {
  it('resolves all twelve by their label exactly', () => {
    // The regression guard for the icons. `openScreen()` matches the whole
    // string, so if this passes, the twenty-odd call sites elsewhere are safe.
    //
    // A disabled tile's name carries its milestone, and with no separator
    // between the two spans it comes out as "CajaM5". That predates the icons —
    // it is why the hub's own tests reach for /Caja/ rather than an exact name —
    // and it is left alone here so this test pins what the icons changed, which
    // is nothing.
    //
    // Narrowed on `to` rather than on `milestone`: an unbuilt tile now *always*
    // carries one, which is what the `Tile` union enforces.
    render(<App />)
    for (const tile of TILES) {
      const label = t(tile.key)
      const name = tile.to === null ? `${label}${tile.milestone}` : label
      expect(screen.getByRole('button', { name }), name).toBeDefined()
    }
  })

  it('keeps each quadrant a section headed by its title', () => {
    // `quadrant()` in HubScreen.test.tsx resolves the panel by walking from the
    // heading to `closest('section')`. Both halves of that are load-bearing.
    render(<App />)
    for (const { title, key } of QUADRANTS) {
      const section = screen.getByRole('heading', { name: t(title) }).closest('section')
      expect(section, title).not.toBeNull()
      expect(section?.getAttribute('data-quadrant')).toBe(key)
    }
  })
})

describe('every section declares its colour', () => {
  // Colour lives in CSS and structure in TS, so a section can be *named* here
  // and never *defined* there — which renders as a quadrant with no face and an
  // invisible edge. Resolved from the repo root rather than `import.meta.url`:
  // under vite-node that is not a file URL and `readFileSync` refuses it.
  const css = readFileSync(resolve(process.cwd(), 'packages/app/src/screens/HubScreen.css'), 'utf8')

  /** The first declaration block for one section, or `null` if there is none. */
  function ruleFor(key: string): string | null {
    const start = css.indexOf(`.hub__quadrant[data-quadrant='${key}']`)
    if (start < 0) return null
    return css.slice(start, css.indexOf('}', start))
  }

  it.each(QUADRANTS.map((q) => q.key))('%s declares a face and an ink', (key) => {
    const rule = ruleFor(key)
    expect(rule, `no rule for ${key}`).not.toBeNull()
    expect(rule, `${key} is missing --quad-face`).toContain('--quad-face')
    expect(rule, `${key} is missing --quad-ink`).toContain('--quad-ink')
  })

  it('gives no two sections the same face', () => {
    const faces = QUADRANTS.map((q) => /--quad-face:\s*([^;]+);/.exec(ruleFor(q.key) ?? '')?.[1])
    expect(new Set(faces).size).toBe(QUADRANTS.length)
  })

  it('never paints a tile a colour the section did not choose', () => {
    // The rule this file exists to protect. The bevels are mixed from the face
    // rather than picked per section — hand-picking is exactly how the badge
    // rim once acquired six invented neutrals that looked fine and were wrong.
    const tile = css.slice(
      css.indexOf('\n.hub__tile {'),
      css.indexOf('}', css.indexOf('\n.hub__tile {')),
    )

    expect(tile).toContain('var(--quad-face)')
    expect(tile).toContain('var(--quad-ink)')
    // Every border colour is a mix of the face, never a literal.
    for (const [, value] of tile.matchAll(/border-\w+-color:\s*([^;]+);/g)) {
      expect(value, `hard-coded bevel: ${value}`).toContain('var(--quad-face)')
    }
  })

  it('places every quadrant by name rather than by source order', () => {
    // Placement used to key on `:nth-of-type`, so reordering QUADRANTS silently
    // rearranged the screen — and the rules were duplicated in the media query,
    // which is the sort of pair that drifts.
    //
    // Comments are stripped first: the claim is about selectors, and the comment
    // explaining the change naturally mentions the thing it removed.
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('nth-of-type')
    for (const { key } of QUADRANTS) {
      expect(css, key).toContain(`[data-quadrant='${key}']`)
    }
  })
})
