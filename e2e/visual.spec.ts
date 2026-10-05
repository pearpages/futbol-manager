import { expect, test } from '@playwright/test'
import { stories, storyUrl } from './stories.ts'

/**
 * Screenshots of the design system's stories — foundations, primitives,
 * components — compared with reference images (ADR 0023). A change to a token
 * or to `chrome.css` shows up here as a picture, which no assertion can see.
 *
 * Not the screens: they show game data that moves with every balance change, so
 * their images would churn and teach everyone to approve diffs unseen.
 *
 * The references are made on Linux, in CI, because the game uses system fonts
 * and they render differently elsewhere. On any other platform this skips.
 */
test.skip(process.platform !== 'linux', 'reference images are made on Linux')

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1280, height: 800 },
] as const

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    for (const story of stories().filter((s) => !s.id.startsWith('screens--'))) {
      test(story.id, async ({ page }) => {
        await page.goto(storyUrl(story.id))
        await page.waitForSelector('#storybook-root > *, body > .modal', { state: 'attached' })
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveScreenshot(`${story.id}--${size.name}.png`, { fullPage: true })
      })
    }
  })
}
