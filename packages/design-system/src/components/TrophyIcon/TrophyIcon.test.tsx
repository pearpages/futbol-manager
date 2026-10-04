import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrophyIcon } from './TrophyIcon.tsx'

describe('TrophyIcon', () => {
  it('is a decorative image, dimmed while nobody has won it', () => {
    const { container } = render(<TrophyIcon trophy="league" src="/art/league.webp" empty />)
    const img = container.querySelector('img')
    expect(img?.className).toBe('trophy is-empty')
    expect(img?.getAttribute('data-trophy')).toBe('league')
    expect(img?.getAttribute('src')).toBe('/art/league.webp')
    expect(img?.getAttribute('alt')).toBe('')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })
})
