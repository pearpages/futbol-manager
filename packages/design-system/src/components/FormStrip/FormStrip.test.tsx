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
})
