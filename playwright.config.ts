import { defineConfig, devices } from '@playwright/test'

/**
 * Browser checks (ADR 0023), against built output:
 * - `layout`: every story at 390, 768 and 1280 — no sideways scroll, readable
 *   contrast, text off the panel edge, and on a phone no target under 24px.
 * - `visual`: screenshots of the design system's stories (not the screens),
 *   compared with images made on Linux; skipped elsewhere, since fonts differ.
 * - `smoke`: the real game, from a new career to a reload and Continue.
 *
 * Run `pnpm build && pnpm --filter @fm/app build-storybook` first; `pnpm e2e`
 * serves both. Locally it drives the Chrome you have; CI installs Chromium.
 */
const STORYBOOK = 'http://localhost:6106'
const GAME = 'http://localhost:4321'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: process.env['CI'] !== undefined ? [['list'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: 'e2e/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' } },
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env['CI'] === undefined ? { channel: 'chrome' } : {}),
  },
  projects: [
    { name: 'layout', testMatch: /layout\.spec\.ts/, use: { baseURL: STORYBOOK } },
    { name: 'visual', testMatch: /visual\.spec\.ts/, use: { baseURL: STORYBOOK } },
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { baseURL: GAME } },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @fm/app exec vite preview --outDir storybook-static --port 6106 --strictPort',
      url: `${STORYBOOK}/index.json`,
      reuseExistingServer: process.env['CI'] === undefined,
    },
    {
      // Not 4173: on some machines another app's service worker owns that origin.
      command: 'pnpm --filter @fm/app exec vite preview --port 4321 --strictPort',
      url: GAME,
      reuseExistingServer: process.env['CI'] === undefined,
    },
  ],
})
