import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, BadgeDefs } from './Badge.tsx'
import { needsNameplate } from './badges.ts'

const spec = { colours: 'garnet-blue', pattern: 'stripes', shape: 'shield' } as const

describe('Badge', () => {
  it('paints its scheme, shape and code, and carries the name as a tooltip', () => {
    const { container } = render(<Badge badge={spec} code="BAR" name="Barcelona" />)
    const svg = container.querySelector('svg.club-badge')
    expect(svg?.getAttribute('data-colours')).toBe('garnet-blue')
    expect(svg?.getAttribute('data-shape')).toBe('shield')
    expect(svg?.querySelector('title')?.textContent).toBe('Barcelona')
    expect(svg?.querySelector('.club-badge__code')?.textContent).toBe('BAR')
  })

  it('is decoration unless labelled, and an image named for the club when it is', () => {
    const { container, rerender } = render(<Badge badge={spec} code="BAR" name="Barcelona" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    rerender(<Badge badge={spec} code="BAR" name="Barcelona" labelled />)
    expect(screen.getByRole('img', { name: 'Barcelona' })).toBeDefined()
  })

  it('puts a nameplate behind the code only on a busy pattern', () => {
    expect(needsNameplate('stripes')).toBe(true)
    expect(needsNameplate('solid')).toBe(false)
  })

  it('defines each shape once, for every badge on the page to clip to', () => {
    const { container } = render(<BadgeDefs />)
    expect(container.querySelectorAll('clipPath')).toHaveLength(5)
  })
})
