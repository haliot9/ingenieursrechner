import { expect, test } from '@playwright/test'

test('solver-heavy below-fold code is absent at first paint and loads near the module chapter', async ({ page }) => {
  const scriptRequests: string[] = []
  page.on('response', response => {
    if (response.url().endsWith('.js')) scriptRequests.push(response.url())
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  await page.waitForTimeout(250)

  expect(scriptRequests.some(url => /solver-[^/]+\.js$/.test(url))).toBe(false)
  expect(scriptRequests.some(url => /CalculatorPage-[^/]+\.js$/.test(url))).toBe(false)

  const solverResponse = page.waitForResponse(response => /solver-[^/]+\.js$/.test(response.url()))
  await page.locator('#module').scrollIntoViewIfNeeded()
  await solverResponse
  await expect(page.getByRole('heading', { name: 'Ein System. Endliche, prüfbare Rechenräume.' })).toBeVisible()
})
