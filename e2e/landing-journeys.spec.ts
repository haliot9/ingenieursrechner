import { expect, test, type Locator, type Page } from '@playwright/test'

function collectRuntimeErrors(page: Page, allowExpectedFailedResource = false) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (allowExpectedFailedResource && message.text() === 'Failed to load resource: net::ERR_FAILED') return
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function tabTo(page: Page, target: Locator, maximumTabs = 40) {
  await expect(target).toBeVisible()
  for (let index = 0; index < maximumTabs; index += 1) {
    if (await target.evaluate(element => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Keyboard focus did not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}`)
}

test('failed Wright media keeps the responsive landing proposition usable', async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page, true)
  const failedMediaRequests: string[] = []
  page.on('requestfailed', request => {
    if (/wright-flyer-(?:scroll-gop6\.mp4|poster\.webp)$/.test(request.url())) {
      failedMediaRequests.push(request.url())
    }
  })
  await page.route(/wright-flyer-(?:scroll-gop6\.mp4|poster\.webp)$/, route => route.abort('failed'))

  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Nicht nur rechnen. Systeme verstehen.' })).toBeVisible()
  await expect(page.getByText('Bekannte Größen eingeben. Beziehungen prüfen. Den vollständigen Rechenweg nachvollziehen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Navigation öffnen' })).toBeVisible()
  expect(failedMediaRequests.length).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  const expectedViewport = testInfo.project.name === 'mobile-chromium'
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 }
  expect(page.viewportSize()).toEqual(expectedViewport)

  if (testInfo.project.name === 'mobile-chromium') {
    for (const control of [
      page.locator('.landing-shell__calculator-link'),
      page.locator('.landing-shell__theme-toggle'),
      page.getByRole('button', { name: 'Navigation öffnen' }),
    ]) {
      const box = await control.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  }

  expect(runtimeErrors).toEqual([])
})

test('floating rail and explorer are operable using only the keyboard', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.goto('./')

  const trigger = page.getByRole('button', { name: 'Navigation öffnen' })
  await tabTo(page, trigger)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Seitennavigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')
  const thermodynamicsChapter = page.getByRole('dialog').getByRole('button', { name: 'Thermodynamik' })
  await tabTo(page, thermodynamicsChapter)
  await page.keyboard.press('Enter')

  const exploreField = page.getByRole('button', { name: 'Thermodynamik erkunden' })
  await tabTo(page, exploreField)
  await page.keyboard.press('Enter')

  const exploreCycles = page.getByRole('button', { name: 'Kreisprozesse erkunden' })
  await tabTo(page, exploreCycles)
  await page.keyboard.press('Enter')

  const carnot = page.getByRole('button', { name: 'Carnot-Prozess', exact: true })
  await tabTo(page, carnot)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Carnot-Prozess' })).toBeVisible()
  await expect(page.getByText('T-s Diagramm')).toBeVisible()

  const explorerBack = page.locator('.thermodynamics-explorer__back')
  await tabTo(page, explorerBack)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Joule-/Brayton-Prozess', exact: true })).toBeVisible()

  expect(runtimeErrors).toEqual([])
})

test('reduced motion presents stable media and direct explorer transitions', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')

  await expect(page.locator('.landing-shell')).toHaveAttribute('data-reduced-motion', 'true')
  await expect(page.locator('.particle-field')).toHaveCount(0)
  expect(await page.locator('.wright-hero-sticky').evaluate(element => getComputedStyle(element).position)).toBe('relative')

  await page.locator('#thermodynamik').scrollIntoViewIfNeeded()
  const advance = page.getByRole('button', { name: 'Thermodynamik erkunden' })
  await expect(advance).toBeVisible()
  expect(await page.locator('.thermodynamics-explorer__panel').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await advance.click()
  await expect(page.getByRole('heading', { name: 'Kreisprozesse' })).toBeVisible()

  expect(runtimeErrors).toEqual([])
})
