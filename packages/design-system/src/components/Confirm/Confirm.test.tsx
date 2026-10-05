import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Confirm } from './Confirm.tsx'

describe('Confirm', () => {
  it('asks, and only acts on the action button', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <Confirm
        title="Sign him?"
        confirmLabel="Sign"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>3 M€ leaves 19 M€.</p>
      </Confirm>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Sign him?' })
    expect(dialog.textContent).toContain('3 M€ leaves 19 M€.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sign' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('puts cancel before the action', () => {
    render(
      <Confirm
        title="T"
        confirmLabel="Go"
        cancelLabel="Stay"
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        x
      </Confirm>,
    )
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(['Stay', 'Go'])
  })
})
