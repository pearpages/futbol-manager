import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubFigure } from './HubFigure.tsx'

describe('HubFigure', () => {
  it('is a decorative image from the given source', () => {
    const { container } = render(<HubFigure figure="agent" src="/art/agent.webp" />)
    const img = container.querySelector('img')
    expect(img?.className).toBe('hub-figure')
    expect(img?.getAttribute('data-figure')).toBe('agent')
    expect(img?.getAttribute('src')).toBe('/art/agent.webp')
    expect(img?.getAttribute('alt')).toBe('')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })
})
