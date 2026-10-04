import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StadiumView } from './StadiumView.tsx'

describe('StadiumView', () => {
  it('is a decorative drawing, scaled by its capacity rung', () => {
    const { container } = render(<StadiumView src="/art/stadium/40k.webp" seats="40k" />)
    const img = container.querySelector('img')
    expect(img?.className).toBe('stadium')
    expect(img?.getAttribute('data-seats')).toBe('40k')
    expect(img?.getAttribute('src')).toBe('/art/stadium/40k.webp')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })
})
