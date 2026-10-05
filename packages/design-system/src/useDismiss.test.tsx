import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useDismiss } from './useDismiss.ts'

function Menu() {
  const [open, setOpen] = useState(true)
  const ref = useRef<HTMLSpanElement>(null)
  useDismiss(ref, open, () => {
    setOpen(false)
  })
  return (
    <>
      <span ref={ref}>
        <button type="button">Menu</button>
        {open && <span role="group" aria-label="Items" />}
      </span>
      <p>Elsewhere</p>
    </>
  )
}

describe('useDismiss', () => {
  it('stays open for a press inside', () => {
    render(<Menu />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.queryByRole('group')).not.toBeNull()
  })

  it('closes on a press outside', () => {
    render(<Menu />)
    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('closes on Escape and hands focus back to the opener', () => {
    render(<Menu />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('group')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }))
  })
})
