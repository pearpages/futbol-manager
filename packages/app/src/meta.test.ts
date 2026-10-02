import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from './i18n/en.ts'

/**
 * The sharing metadata in `index.html`.
 *
 * That file is outside every other test's reach — jsdom is handed a bare document
 * and never sees it — so nothing in the suite could tell whether the game unfurls
 * as a card or as a naked URL. It unfurled as a naked URL for the whole of the
 * project's life until the day the site went live.
 *
 * The failures worth guarding are all silent ones. A relative `og:image` renders
 * nothing on every platform and looks fine in a browser. A renamed or re-cut card
 * leaves the declared dimensions lying, and a crawler that trusts them crops the
 * wordmark off. And the name's spelling is a rule rather than a preference — ADR
 * 0012 decision 3 — with `index.html` the one surface that cannot read the
 * dictionary at build time.
 */

const ROOT = resolve(process.cwd(), 'packages/app')
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8')

/** The origin the site is actually served from — see `docs/stack.md`. */
const SITE = 'https://futbol.pearpages.com'

/**
 * Every `<meta>` in the file, as property/name → content. Order is not asserted.
 *
 * One pattern covers both shapes: prettier wraps the long tags onto their own
 * attribute lines, and `\s` matches a newline already — the `s` flag would only
 * change what `.` does, which is why a second pattern for the wrapped ones is not
 * merely redundant but double-counts every tag it sees.
 */
function metaTags(): Map<string, string[]> {
  const tags = new Map<string, string[]>()
  for (const [, key, content] of html.matchAll(
    /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*\/>/g,
  )) {
    // Both groups are required by the pattern, so this only satisfies the
    // compiler's view of `matchAll` — a miss here means the regex changed.
    if (key === undefined || content === undefined) continue
    tags.set(key, [...(tags.get(key) ?? []), content])
  }
  return tags
}

const meta = metaTags()
const one = (key: string) => {
  const values = meta.get(key)
  expect(values, `no <meta> for ${key}`).toBeDefined()
  expect(values, `${key} is declared more than once`).toHaveLength(1)
  return values?.[0] ?? ''
}

/**
 * A JPEG's real pixel size, read from its first SOF marker.
 *
 * Twenty lines rather than a dependency, and it is the assertion with teeth: the
 * declared width and height are what a crawler lays the card out from, so a
 * re-cut at the wrong size is a wrong card everywhere and a green suite here.
 */
function jpegSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path)
  expect(buf.readUInt16BE(0), `${path} is not a JPEG`).toBe(0xffd8)

  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`bad marker at ${i} in ${path}`)
    const marker = buf[i + 1] ?? 0
    // SOF0..SOF15, skipping the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error(`no SOF marker in ${path}`)
}

describe('sharing metadata', () => {
  it('declares the tags an unfurler needs', () => {
    for (const key of [
      'description',
      'og:type',
      'og:site_name',
      'og:url',
      'og:title',
      'og:description',
      'og:image',
      'og:image:type',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
      'og:locale',
      'twitter:card',
    ]) {
      one(key)
    }
    // The only tag deliberately repeated, one per translation that exists.
    expect(meta.get('og:locale:alternate')).toEqual(['ca_ES', 'es_ES'])
  })

  it('gives the card as an absolute URL', () => {
    // A scraper does not resolve a relative path against the page it found it on,
    // and `/og.jpg` looks perfectly correct in a browser while unfurling as
    // nothing. Same for the canonical.
    expect(one('og:image').startsWith(`${SITE}/`), one('og:image')).toBe(true)
    expect(one('og:url')).toBe(`${SITE}/`)
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`)
  })

  it('points at a card that exists, at the size it claims', () => {
    const name = one('og:image').slice(`${SITE}/`.length)
    const path = resolve(ROOT, 'public', name)

    expect(() => statSync(path), `${name} is not in public/`).not.toThrow()
    expect(jpegSize(path)).toEqual({
      width: Number(one('og:image:width')),
      height: Number(one('og:image:height')),
    })
    expect(one('og:image:type')).toBe('image/jpeg')

    // Comfortably inside every platform's limit, including the few hundred KB
    // some chat clients apply to a preview thumbnail.
    expect(statSync(path).size, 'the card has grown past a thumbnail budget').toBeLessThan(
      400 * 1024,
    )
  })

  it('spells the name the way the rest of the game does', () => {
    // `index.html` is the one surface that cannot read the dictionary, so the
    // unaccented spelling ADR 0012 decision 3 fixed can drift here alone.
    expect(one('og:title')).toBe(en['shell.wordmark'])
    expect(one('og:site_name')).toBe(en['shell.wordmark'])
    expect(html).toContain(`<title>${en['shell.wordmark']}</title>`)
  })

  it('links icons that exist in public/', () => {
    // A missing icon fails quietly: the tab shows a blank page and the live
    // site logs a 404, which is how `/favicon.ico` went unnoticed until launch.
    const icons = [...html.matchAll(/<link rel="(icon|apple-touch-icon)" href="\/([^"]+)"/g)]
    expect(icons.map(([, rel]) => rel)).toEqual(['icon', 'icon', 'apple-touch-icon'])
    for (const [, , name] of icons) {
      expect(
        () => statSync(resolve(ROOT, 'public', name ?? '')),
        `${name} is not in public/`,
      ).not.toThrow()
    }
  })

  it('keeps the description short enough to survive every card', () => {
    // Around 200 is where the tighter surfaces start cutting. Both copies are the
    // same sentence and must stay that way.
    const description = one('description')
    expect(description.length).toBeLessThanOrEqual(200)
    expect(one('og:description')).toBe(description)
  })
})
