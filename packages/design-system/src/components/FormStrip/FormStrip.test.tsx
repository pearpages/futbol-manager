import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormStrip } from './FormStrip.tsx'

describe('FormStrip', () => {
  it('draws one square per pip, coloured by outcome and worded for screen readers', () => {
    render(
      <FormStrip
        label="Latest results"
        pips={[
          { key: 'b', outcome: null, text: 'Not played' },
          { key: 'w', outcome: 'win', text: 'Won 2–1' },
        ]}
      />,
    )
    const items = screen.getByRole('list', { name: 'Latest results' }).querySelectorAll('li')
    expect([...items].map((li) => li.className)).toEqual([
      'form-strip__pip',
      'form-strip__pip is-win',
    ])
    expect(items[1]?.textContent).toBe('Won 2–1')
  })

  it('draws the letter on a played square, hidden from the sentence read out', () => {
    render(
      <FormStrip
        label="Latest results"
        pips={[
          { key: 'a', outcome: null, text: 'Not played' },
          { key: 'b', outcome: 'loss', text: 'Lost 0–1', mark: 'L' },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]?.querySelector('.form-strip__mark')).toBeNull()
    const mark = items[1]?.querySelector('.form-strip__mark')
    expect(mark?.textContent).toBe('L')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
  })
})
