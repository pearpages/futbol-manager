import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Explain } from './Explain.tsx'

describe('Explain', () => {
  it('opens a dialog with every paragraph, and closes it', () => {
    render(
      <Explain
        label="Explain: wages"
        title="Wages"
        paragraphs={['One.', 'Two.']}
        closeLabel="Close"
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Explain: wages' }))
    const dialog = screen.getByRole('dialog', { name: 'Wages' })
    expect(dialog.textContent).toContain('One.')
    expect(dialog.textContent).toContain('Two.')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
