import { expect, test, type Page } from '@playwright/test'

function collectRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('root CTA uses query routing and browser Back restores the landing page', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.goto('./')

  await page.locator('.landing-shell__calculator-link').click()
  await expect(page).toHaveURL(/\?view=calculator&module=carnot$/)
  await expect(page.getByRole('heading', { name: 'Carnot-Prozess' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  expect(runtimeErrors).toEqual([])
})

test('direct Joule query solves the real reference-air calculator journey', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.goto('./?view=calculator&module=joule')

  await expect(page.getByRole('heading', { name: 'Joule-/Brayton-Prozess' })).toBeVisible()
  await page.getByRole('button', { name: /Referenzfall Luft/ }).click()

  await expect(page.getByText('Zyklus gelöst')).toBeVisible()
  const efficiency = page.locator('.metric').filter({ hasText: 'Wirkungsgrad' }).locator('strong')
  await expect(efficiency).toHaveText('48,21 %')
  await expect(page.getByText('p-v Diagramm')).toBeVisible()
  await expect(page.getByText('T-s Diagramm')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Vollständiger Rechenweg' })).toBeVisible()

  expect(runtimeErrors).toEqual([])
})
