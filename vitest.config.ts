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
          /*
           * Same reasoning as the app project below, for a different cause. The
           * statistical harnesses simulate hundreds of seasons; `determinism at
           * scale` alone runs 50 twice and measures ~5.5s under load against the
           * 5s default, which `CLAUDE.md` had already recorded as a one-off flake.
           * The formation sweep that used to sit beside it now lives in `@fm/data`,
           * because it has to measure the shipped league rather than generated
           * squads — but it still competes for the same cores, so the budget stays
           * stated rather than left to luck.
           *
           * The whole project is ~18s on its own. Anything here approaching 30s is
           * a real problem, not a scheduling one.
           */
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'data',
          root: 'packages/data',
          environment: 'node',
          /*
           * `formations.harness.test.ts` simulates 600 seasons of the real league.
           * That work happens at module scope — collection, not a test body — so
           * `testTimeout` does not gate it and the assertions themselves are
           * instant. The budget is here for the same reason as the domain
           * project's: so a slow scheduler reads as slow rather than as broken.
           */
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'persistence',
          root: 'packages/persistence',
          environment: 'node',
          // Node has no IndexedDB either, and `store.ts` is most of this package.
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'app',
          root: 'packages/app',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          /*
           * The default 5s is not a meaningful budget here. The market screen
           * renders every listing — a couple of hundred rows, each carrying a
           * club badge — and jsdom is orders of magnitude slower at that than a
           * browser. The slowest test is ~3s on its own and only tips over 5s
           * when all five projects compete for CPU, which is a scheduling fact
           * rather than a defect.
           *
           * Not cover for a slow test creeping in: anything approaching 15s here
           * is genuinely wrong. If this screen has to get cheaper the lever is
           * pagination, never a silent row cap.
           */
          testTimeout: 15_000,
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
