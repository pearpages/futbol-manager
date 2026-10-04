import { readFileSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ICON_KEYS, TileIcon } from './components/TileIcon/TileIcon.tsx'

/**
 * The package's `assets/` are copies, for the Claude Design System artifact.
 * The app serves the originals from `packages/app/public`, and these tests keep
 * the two from drifting apart. The icons are generated from `TileIcon` itself:
 * `pnpm --filter @fm/design-system assets:build` rewrites them.
 */

const here = (path: string) => new URL(path, import.meta.url)
const WRITE = process.env.ASSETS_WRITE === '1'

const COPIES: readonly [copy: string, original: string][] = [
  ['Logos/favicon.svg', 'favicon.svg'],
  ['Logos/pearpages-icon.png', 'pearpages-icon.png'],
  ['Images/cover.webp', 'cover.webp'],
  ['Images/assistant.webp', 'art/assistant.webp'],
  ['Images/trainer.webp', 'art/trainer.webp'],
  ['Images/agent.webp', 'art/agent.webp'],
  ['Images/director.webp', 'art/director.webp'],
  ['Images/league.webp', 'art/league.webp'],
  ['Images/stadium-40k.webp', 'art/stadium/40k.webp'],
]

/** A tile icon as a standalone file: the same geometry, inked with currentColor. */
function iconSvg(icon: (typeof ICON_KEYS)[number]): string {
  const inner = renderToStaticMarkup(<TileIcon icon={icon} />).replace(/^<svg[^>]*>|<\/svg>$/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${inner}</svg>\n`
}

describe('assets', () => {
  it.each(COPIES)('%s is byte-identical to the app’s public/%s', (copy, original) => {
    const ours = readFileSync(here(`../assets/${copy}`))
    const theirs = readFileSync(here(`../../app/public/${original}`))
    expect(ours.equals(theirs)).toBe(true)
  })

  it.each(ICON_KEYS)('assets/Icons/%s.svg is drawn from TileIcon', (icon) => {
    const path = here(`../assets/Icons/${icon}.svg`)
    if (WRITE) writeFileSync(path, iconSvg(icon))
    expect(readFileSync(path, 'utf8')).toBe(iconSvg(icon))
  })
})
