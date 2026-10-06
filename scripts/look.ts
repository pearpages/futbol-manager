/**
 * Look at a page in a real, headless browser — the measuring half of "green
 * suite, broken screen" (AGENTS.md).
 *
 *   pnpm look <url> [width] [out.png]
 *
 * Prints the page's scroll width against the viewport and, given a path, writes
 * a full-page screenshot. A throwaway that needs more imports `look` instead of
 * launching Chrome itself:
 *
 *   import { look } from '/…/futbol-manager/scripts/look.ts'
 *   await look('http://localhost:4321', 390, async (page) => { … })
 *
 * Never hand-spawn a `--remote-debugging-port` Chrome: it outlives a Node process
 * that throws or is killed, and those orphans piled up for days. Here the browser
 * is closed in `finally`, Playwright closes it on SIGINT/SIGTERM/SIGHUP, and a
 * watchdog outside Node ends it after anything Node cannot catch — SIGKILL, or a
 * timeout's SIGALRM. Without the watchdog even Playwright's browser survives those.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'

export async function look<T>(
  url: string,
  width: number,
  use: (page: Page) => Promise<T>,
): Promise<T> {
  const profile = mkdtempSync(join(tmpdir(), 'fm-look-'))
  // The profile reaches the watchdog through its environment, not its arguments,
  // so `pkill -f` matches the browser and not the watchdog running it.
  spawn(
    '/bin/sh',
    [
      '-c',
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done; pkill -f "$FM_LOOK_PROFILE"; rm -rf "$FM_LOOK_PROFILE"`,
    ],
    { detached: true, stdio: 'ignore', env: { ...process.env, FM_LOOK_PROFILE: profile } },
  ).unref()
  // The Chrome you have, as `pnpm e2e` uses locally (playwright.config.ts).
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    viewport: { width, height: 900 },
  })
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(url)
    return await use(page)
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const [url, widthArg = '390', out] = process.argv.slice(2)
  const width = Number(widthArg)
  if (url === undefined || !Number.isInteger(width) || width <= 0) {
    console.error('Usage: pnpm look <url> [width] [out.png]')
    process.exit(1)
  }
  const scrollWidth = await look(url, width, async (page) => {
    if (out !== undefined) await page.screenshot({ path: out, fullPage: true })
    return page.evaluate(() => document.documentElement.scrollWidth)
  })
  console.log(`${url} at ${width}px: scroll width ${scrollWidth}px`)
  if (scrollWidth > width) console.log('sideways scroll')
}
