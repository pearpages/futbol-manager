import { expect, type Page, test } from '@playwright/test'
import { lowContrast, sidewaysScroll, smallTargets, tightText } from './audits.ts'
import { stories, storyUrl, WIDTHS } from './stories.ts'

/**
 * Every story, at every width, checked for what a player would see broken
 * (ADR 0023, P20): the page scrolling sideways, text too faint to read, text
 * against a panel's edge, and on a phone a control too small for a thumb. The
 * dialogs the stories can open are checked the same way.
 */

/** Dialogs worth checking, opened from a story by the button that opens them. */
const DIALOGS: Readonly<Record<string, readonly (readonly [string, RegExp | string])[]>> = {
  'screens--hub': [['news', /^Mostra-ho tot/]],
  'screens--squad': [['explain', 'Explica: com llegir aquesta taula']],
  'screens--estadio': [['confirm', 'Comença les obres']],
  'screens--setup': [['confirm', /Fes-te/]],
}

async function render(page: Page, id: string) {
  await page.goto(storyUrl(id))
  await page.waitForSelector('#storybook-root > *, body > .modal', { state: 'attached' })
  await page.waitForLoadState('networkidle')
}

async function check(page: Page, touch: boolean) {
  expect(await page.evaluate(sidewaysScroll), 'scrolls sideways').toBe(0)
  expect(await page.evaluate(lowContrast), 'text below WCAG AA').toEqual([])
  expect(await page.evaluate(tightText), 'text within 8px of its panel edge').toEqual([])
  if (touch) expect(await page.evaluate(smallTargets), 'targets under 24px').toEqual([])
}

for (const size of WIDTHS) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    })

    for (const story of stories()) {
      test(story.id, async ({ page }) => {
        await render(page, story.id)
        await check(page, size.touch)
      })

      for (const [dialog, opener] of DIALOGS[story.id] ?? []) {
        test(`${story.id} › ${dialog}`, async ({ page }) => {
          await render(page, story.id)
          await page.getByRole('button', { name: opener }).first().click()
          await page.getByRole('dialog').waitFor()
          await check(page, size.touch)
        })
      }
    }
  })
}
