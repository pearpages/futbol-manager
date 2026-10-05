import { useSyncExternalStore } from 'react'

/**
 * The phone breakpoint, for the few layout changes that need code rather than
 * CSS (ADR 0018, 0019): the app's phone shell, and a full-screen dialog's close
 * button. It must match the `@media (width < 40rem)` blocks.
 */
export const PHONE_QUERY = '(width < 40rem)'

const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE_QUERY)
    : null

function subscribe(onChange: () => void): () => void {
  const list = media()
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

/**
 * True on a phone-width window. False wherever there is no `matchMedia`, which
 * includes the test environment: jsdom does no layout, so tests see the desk.
 */
export function usePhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  )
}
