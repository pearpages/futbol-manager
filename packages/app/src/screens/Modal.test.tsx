import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal.tsx'

/**
 * The dialog primitive.
 *
 * Driven directly rather than through `<App />`, unlike every screen test — this
 * is a primitive with no game in it, and the behaviour worth pinning (Escape, the
 * backdrop, where focus goes) is the app's first keyboard handling of any kind.
 */

function open(onClose = vi.fn()) {
  const result = render(
    <Modal title="Saved games" onClose={onClose}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </Modal>,
  )
  return { onClose, ...result }
}

describe('Modal', () => {
  it('names itself to assistive technology', () => {
    open()
    const dialog = screen.getByRole('dialog')

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // The name comes from the heading, so it cannot drift from what is on screen.
    expect(dialog.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { name: 'Saved games' }).id,
    )
  })

  it('closes on Escape', () => {
    const { onClose } = open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a click outside the box', () => {
    const { onClose, container } = open()
    fireEvent.click(container.querySelector('.modal') as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on a click inside it, however deep', () => {
    const { onClose } = open()
    fireEvent.click(screen.getByRole('button', { name: 'First' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('takes focus on opening and hands it back on closing', () => {
    // A dialog that leaves focus behind is one a keyboard user has to hunt for;
    // one that drops focus on closing puts them back at the top of the page.
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount } = open()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps Tab inside the box, in both directions', () => {
    open()
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('keeps shift-Tab inside even from the box itself, which is where focus starts', () => {
    // The third edge, and the one a two-sided trap misses: the box is not in the
    // tab order, so `activeElement` is neither the first control nor the last.
    open()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }))
  })
})
