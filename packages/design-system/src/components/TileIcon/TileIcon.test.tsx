import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ICON_KEYS, TileIcon } from './TileIcon.tsx'

describe('TileIcon', () => {
  it.each(ICON_KEYS)('draws %s hidden from screen readers, with no text', (icon) => {
    const html = renderToStaticMarkup(<TileIcon icon={icon} />)
    expect(html).toMatch(/^<svg class="tile-icon" viewBox="0 0 24 24" aria-hidden="true">/)
    expect(html.replace(/<[^>]*>/g, '')).toBe('')
  })
})
