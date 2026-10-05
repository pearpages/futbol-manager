import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon.tsx'
import { ICON_NAMES, ICON_PATHS } from './icons.ts'

describe('Icon', () => {
  it('draws every glyph hidden from assistive technology, with no text', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
      expect(svg?.textContent).toBe('')
      expect(svg?.querySelector('path')?.getAttribute('d')).toBe(ICON_PATHS[name])
      unmount()
    }
  })

  it('keeps geometry only: no colour in the paths', () => {
    for (const d of Object.values(ICON_PATHS)) expect(d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/)
  })
})
