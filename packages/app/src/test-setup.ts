import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { useGame } from './store.ts'

/**
 * Testing Library only registers its own auto-cleanup when Vitest globals are on,
 * and they are not — tests import `describe`/`it` explicitly. Without this every
 * `render` stacks into the same document and queries start finding duplicates.
 */
afterEach(cleanup)

/**
 * jsdom has no layout, so it implements no scrolling at all — not even a no-op.
 * A screen that scrolls a panel into view would throw here rather than in a
 * browser, which is a test failing for a reason the product does not have.
 */
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

/**
 * Every test runs in English.
 *
 * The product default is Catalan, and the suite asserts on copy — headings,
 * button labels, the words a notice uses. Pinning the language is the same
 * discipline as pinning the rng seed: the tests are about behaviour, and a
 * behaviour test that also happens to be a translation test fails twice for one
 * reason and tells you neither.
 *
 * `dictionaries.test.ts` is what covers the other two, and `language.test.tsx`
 * covers the switching itself.
 */
beforeEach(() => {
  useGame.setState({ language: 'en' })
})
