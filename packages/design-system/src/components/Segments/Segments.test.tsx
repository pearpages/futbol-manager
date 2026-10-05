import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Segments } from './Segments.tsx'

describe('Segments', () => {
  it('marks the current option and reports another', () => {
    const onChange = vi.fn()
    render(
      <Segments
        label="League"
        options={[
          { value: 'table', label: 'Table' },
          { value: 'results', label: 'Results' },
        ]}
        value="table"
        onChange={onChange}
      />,
    )
    const group = screen.getByRole('group', { name: 'League' })
    expect(group).toBeDefined()
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Results' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Results' }))
    expect(onChange).toHaveBeenCalledWith('results')
  })
})
