import { expect, test } from '@playwright/test'

/**
 * The real game, built and served, from the front door to a saved career and
 * back (ADR 0023). The only path through IndexedDB, the reducer and the shell
 * together that no story and no jsdom test takes.
 */
test.describe('a first career', () => {
  // footfall (ADR 0026) counts real visits; a CI run is not one, and the check must
  // not depend on a server outside this build.
  test.beforeEach(async ({ page }) => {
    await page.route('https://analytics.pearpages.com/**', (route) => route.abort())
  })

  for (const size of [
    { name: 'phone', width: 390, height: 844 },
    { name: 'desk', width: 1280, height: 800 },
  ]) {
    test(`starts, plays a match, saves and continues (${size.name})`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto('/')

      // A new browser has no career, so a new one asks nothing.
      await page.getByRole('button', { name: 'Nova carrera' }).click()
      await page.getByRole('heading', { name: 'Tria un club' }).waitFor()

      // Taking a club says what you take on, then starts.
      await page
        .getByRole('button', { name: /Fes-te/ })
        .first()
        .click()
      const confirm = page.getByRole('dialog')
      await confirm.getByRole('button', { name: /Fes-te/ }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Avui' })).toBeVisible()
      await expect(page.locator('.hub__round')).toHaveText('Jornada 1')

      // The first fixture is due on the first day: play it from the day's action.
      await page.getByRole('button', { name: /^Juga el partit/ }).click()
      const result = page.getByRole('dialog', { name: 'Resultat' })
      await expect(result).toBeVisible()
      await result.getByRole('button', { name: 'Continua' }).click()
      await expect(page.locator('.hub__round')).toHaveText('Jornada 2')

      // Save under a name, through the menu (folded on a phone, inline on the desk).
      const menu = page.getByRole('button', { name: 'Menú' })
      if (await menu.isVisible()) await menu.click()
      await page.getByRole('button', { name: 'Partides' }).click()
      await page.getByLabel(/nom/i).fill('Fum')
      await page.getByRole('button', { name: 'Desa', exact: true }).click()
      await expect(page.getByRole('dialog').getByText('Fum')).toBeVisible()

      // A reload lands on the front door, and Continue picks the career back up.
      await page.reload()
      await page.getByRole('button', { name: 'Continua' }).click()
      await expect(page.locator('.hub__round')).toHaveText('Jornada 2')
    })
  }
})
