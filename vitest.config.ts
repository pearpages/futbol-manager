import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * One command runs all four packages. Each project is named, so `pnpm test -- --run`
 * output shows which package a failure came from — and shows that all four actually
 * ran, rather than one silently matching nothing.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          root: 'packages/domain',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'data',
          root: 'packages/data',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'persistence',
          root: 'packages/persistence',
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'app',
          root: 'packages/app',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        // Not a package — this asserts the repo's own config, chiefly that the
        // ESLint boundary rule still fires. See tests/boundaries.test.ts.
        test: {
          name: 'boundaries',
          root: 'tests',
          environment: 'node',
        },
      },
    ],
  },
})
