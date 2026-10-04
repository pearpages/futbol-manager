import react from '@vitejs/plugin-react'
import { defineProject } from 'vitest/config'

/**
 * The design-system project, picked up by the root `vitest.config.ts`. Its own
 * file rather than an inline entry there, so the package carries everything it
 * needs to be tested on its own.
 */
export default defineProject({
  plugins: [react()],
  test: {
    name: 'design-system',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
