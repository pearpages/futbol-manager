import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
    // In `document.body`, not the render container: the dialog is portalled.
    const { onClose } = open()
    fireEvent.click(document.querySelector('.modal') as Element)
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

  it('holds the page still while open, and lets go once the last dialog closes', () => {
    const root = document.documentElement
    const outer = render(
      <Modal title="Outer" onClose={() => {}}>
        x
      </Modal>,
    )
    const inner = render(
      <Modal title="Inner" onClose={() => {}}>
        y
      </Modal>,
    )
    expect(root.classList.contains('has-modal')).toBe(true)
    inner.unmount()
    expect(root.classList.contains('has-modal')).toBe(true)
    outer.unmount()
    expect(root.classList.contains('has-modal')).toBe(false)
  })

  it('makes the page behind inert, and only the top dialog of a stack', () => {
    const page = render(<button type="button">Behind</button>)
    const behind = page.container
    const outer = render(
      <Modal title="Outer" onClose={() => {}}>
        x
      </Modal>,
    )
    const outerOverlay = screen.getByRole('dialog', { name: 'Outer' }).parentElement!
    expect(behind.hasAttribute('inert')).toBe(true)
    expect(outerOverlay.hasAttribute('inert')).toBe(false)
    const inner = render(
      <Modal title="Inner" onClose={() => {}}>
        y
      </Modal>,
    )
    expect(outerOverlay.hasAttribute('inert')).toBe(true)
    inner.unmount()
    expect(outerOverlay.hasAttribute('inert')).toBe(false)
    expect(behind.hasAttribute('inert')).toBe(true)
    outer.unmount()
    expect(behind.hasAttribute('inert')).toBe(false)
  })

  it('closes only the top dialog of a stack on Escape', () => {
    const outerClose = vi.fn()
    const innerClose = vi.fn()
    render(
      <Modal title="Outer" onClose={outerClose}>
        x
      </Modal>,
    )
    render(
      <Modal title="Inner" onClose={innerClose}>
        y
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(innerClose).toHaveBeenCalledOnce()
    expect(outerClose).not.toHaveBeenCalled()
  })

  it('offers a close button full-screen on a phone, given its name, and only then', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(width < 40rem)',
      addEventListener() {},
      removeEventListener() {},
    }))
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal title="Saves" onClose={onClose} full>
        x
      </Modal>,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    rerender(
      <Modal title="Saves" onClose={onClose} full closeLabel="Close">
        x
      </Modal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it("pins a full-screen dialog's last row of buttons on a phone", () => {
    // jsdom does no layout, so this reads the rule: the row a thumb needs must
    // stick to the bottom and sink below short content (ADR 0019).
    const css = readFileSync(
      resolve(process.cwd(), 'packages/design-system/src/components/Modal/Modal.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const phone = css.slice(css.indexOf('@media (width < 40rem)'))
    const rule = phone.slice(phone.indexOf('.modal__body > .screen-actions:last-child'))
    const body = rule.slice(rule.indexOf('{'), rule.indexOf('}'))
    expect(body).toMatch(/position:\s*sticky/)
    expect(body).toMatch(/bottom:/)
    expect(body).toMatch(/margin-top:\s*auto/)
  })
})
