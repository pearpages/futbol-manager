import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * Testing Library only registers its own auto-cleanup when Vitest globals are on,
 * and they are not — tests import `describe`/`it` explicitly. Without this every
 * `render` stacks into the same document and queries start finding duplicates.
 */
afterEach(cleanup)
