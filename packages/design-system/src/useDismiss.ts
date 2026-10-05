import { type RefObject, useEffect } from 'react'

/**
 * Closes a floating menu the way every menu closes: a press anywhere outside it,
 * or Escape. `ref` wraps the menu *and* the button that opens it, so pressing
 * the button again toggles rather than closing and reopening.
 *
 * On Escape focus goes back to the first button inside — the opener — so a
 * keyboard user is not dropped onto the page's start (the same promise `Modal`
 * keeps).
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return

    const onPointer = (event: PointerEvent) => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      ref.current?.querySelector<HTMLElement>('button')?.focus()
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}
