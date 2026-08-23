import { expect, test, type Locator, type Page } from '@playwright/test'

function channelToLinear(channel: number) {
  const normalized = channel / 255
  return normalized <= .04045
    ? normalized / 12.92
    : ((normalized + .055) / 1.055) ** 2.4
}

type Rgba = readonly [red: number, green: number, blue: number, alpha: number]

function parseRgb(color: string): Rgba {
  const channels = color.match(/[\d.]+/g)?.map(Number)
  if (!channels || channels.length < 3 || channels.length > 4) {
    throw new Error(`Unsupported computed color: ${color}`)
  }
  return [channels[0], channels[1], channels[2], channels[3] ?? 1]
}

function compositeOver(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3] + background[3] * (1 - foreground[3])
  if (alpha === 0) return [0, 0, 0, 0]
  return [
    (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
    alpha,
  ]
}

function contrastRatio(foreground: Rgba, background: Rgba) {
  const luminance = (color: Rgba) => {
    const [red, green, blue] = color.slice(0, 3).map(channelToLinear)
    return .2126 * red + .7152 * green + .0722 * blue
  }
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + .05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + .05)
}

async function expectNormalTextContrast(control: Locator, label: string) {
  const colors = await control.evaluate(element => {
    const style = getComputedStyle(element)
    return { foreground: style.color, background: style.backgroundColor }
  })
  const foreground = parseRgb(colors.foreground)
  const background = parseRgb(colors.background)
  expect(foreground[3], `${label} foreground must be opaque`).toBe(1)
  expect(background[3], `${label} background must be opaque`).toBe(1)
  expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(4.5)
}

async function expectThemeControlContrast(control: Locator) {
  const paint = await control.evaluate(element => {
    const required = (selector: string) => {
      const match = element.querySelector(selector)
      if (!match) throw new Error(`Theme control is missing ${selector}`)
      return getComputedStyle(match)
    }
    const shell = required('.theme-transition-control__shell')
    const label = required('.theme-transition-control__label')
    return {
      shellBackgroundColor: shell.backgroundColor,
      shellBackgroundImage: shell.backgroundImage,
      labelBackgroundClip: label.backgroundClip,
      labelBackgroundImage: label.backgroundImage,
      labelTextFillColor: label.getPropertyValue('-webkit-text-fill-color'),
    }
  })

  expect(paint.shellBackgroundImage, 'header theme control shell must have a measurable solid surface')
    .toBe('none')
  expect(paint.labelBackgroundClip, 'header theme control label must paint its configured material')
    .toContain('text')
  expect(parseRgb(paint.labelTextFillColor)[3], 'header theme control label uses gradient-clipped text')
    .toBe(0)

  const shell = parseRgb(paint.shellBackgroundColor)
  expect(shell[3], 'header theme control shell must be opaque').toBe(1)
  const labelStops = paint.labelBackgroundImage.match(/rgba?\([^)]*\)/g) ?? []
  expect(labelStops.length, 'header theme control label must expose painted gradient stops')
    .toBeGreaterThan(0)
  const minimumContrast = Math.min(...labelStops.map(stop => {
    const paintedStop = compositeOver(parseRgb(stop), shell)
    return contrastRatio(paintedStop, shell)
  }))
  expect(minimumContrast, 'header theme control painted label against its painted shell')
    .toBeGreaterThanOrEqual(4.5)

  await expectNormalTextContrast(
    control.locator('.theme-transition-control__icon'),
    'header theme control icon',
  )
}

async function scrollDeferredSectionIntoView(page: Page, selector: string) {
  await page.locator(selector).evaluate(element => element.scrollIntoView())
}

test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

test('light-theme primary controls meet WCAG AA contrast', async ({ page }) => {
  await page.goto('./')

  await expectThemeControlContrast(page.locator('.theme-transition-control[data-variant="header"]'))

  await page.getByRole('button', { name: 'Navigation öffnen' }).click()
  await expectNormalTextContrast(page.locator('.floating-rail-calculator'), 'floating rail calculator CTA')
  await page.getByRole('button', { name: 'Navigation schließen' }).click()

  await scrollDeferredSectionIntoView(page, '#thermodynamik')
  await expect(page.getByRole('region', { name: 'Thermodynamik-Menü' })).toBeVisible()
  await expect(page.locator('.thermodynamics-menu__row')).toHaveCount(4)
  await page.locator('.thermodynamics-menu__row[data-module-id="carnot"]').click()
  await expectNormalTextContrast(
    page.getByRole('region', { name: 'Carnot-Prozess' })
      .getByRole('button', { name: 'Im Rechner öffnen' }),
    'inline calculator CTA',
  )

  await scrollDeferredSectionIntoView(page, '#rechenweg')
  await expectNormalTextContrast(page.locator('.joule-proof__calculator'), 'Joule proof CTA')

  await scrollDeferredSectionIntoView(page, '#projekt')
  await expectNormalTextContrast(page.locator('.project-coda__calculator'), 'project coda CTA')
})

const calculatorRoutes = [
  { button: /Carnot-Prozess.*Rechner verfügbar/, heading: 'Carnot-Prozess', id: 'carnot' },
  { button: /Otto-Prozess.*Rechner verfügbar/, heading: 'Otto-Prozess', id: 'otto' },
  { button: /Diesel-Prozess.*Rechner verfügbar/, heading: 'Diesel-Prozess', id: 'diesel' },
  {
    button: /Joule-\/Brayton-Prozess.*Rechner verfügbar/,
    heading: 'Joule-/Brayton-Prozess',
    id: 'joule',
  },
] as const

test('Thermodynamics exposes exactly four keyboard rows in permanent DOM order', async ({ page }) => {
  await page.goto('./')
  await scrollDeferredSectionIntoView(page, '#thermodynamik')

  const menu = page.getByRole('region', { name: 'Thermodynamik-Menü' })
  const rows = menu.locator('.thermodynamics-menu__row')
  await expect(rows).toHaveCount(4)
  expect(await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-module-id'))))
    .toEqual(['carnot', 'otto', 'diesel', 'joule'])
  await expect(menu.locator('.thermodynamics-menu__lead button, .thermodynamics-menu__lead a')).toHaveCount(0)
  await expect(page.locator('.thermodynamics-explorer__advance, .thermodynamics-explorer__back')).toHaveCount(0)

  await rows.first().focus()
  for (let index = 0; index < calculatorRoutes.length; index += 1) {
    await expect(rows.nth(index)).toBeFocused()
    await expect(rows.nth(index)).toHaveAccessibleName(calculatorRoutes[index].button)
    if (index < calculatorRoutes.length - 1) await page.keyboard.press('Tab')
  }
})

test('Enter opens each inline detail without navigation and only its CTA routes', async ({ context }) => {
  for (const route of calculatorRoutes) {
    const page = await context.newPage()
    await page.goto('./')
    await scrollDeferredSectionIntoView(page, '#thermodynamik')
    const landingUrl = page.url()
    const button = page.getByRole('button', { name: route.button })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(landingUrl)
    await expect(button).toBeFocused()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const detail = page.getByRole('region', { name: route.heading })
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('list', { name: 'Prozessfolge' })).toBeVisible()
    await expect(detail.getByLabel('Referenzdiagramm')).toBeVisible()
    await detail.getByRole('button', { name: 'Im Rechner öffnen' }).click()
    await expect(page).toHaveURL(new RegExp(`\\?view=calculator&module=${route.id}$`))
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
    await page.close()
  }
})

test('Joule selection survives browser Back for the coda and floating rail actions', async ({ page }) => {
  await page.goto('./')
  await scrollDeferredSectionIntoView(page, '#thermodynamik')
  await page.getByRole('button', {
    name: /Joule-\/Brayton-Prozess.*Rechner verfügbar/,
  }).click()
  await expect(page).toHaveURL(/\/$/)
  const detail = page.getByRole('region', { name: 'Joule-/Brayton-Prozess' })
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Im Rechner öffnen' }).click()
  await expect(page).toHaveURL(/\?view=calculator&module=joule$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await scrollDeferredSectionIntoView(page, '#projekt')
  await page.getByRole('button', { name: 'Ausgewählten Rechner öffnen' }).click()
  await expect(page).toHaveURL(/\?view=calculator&module=joule$/)

  await page.goBack()
  await page.getByRole('button', { name: 'Navigation öffnen' }).click()
  await page.getByRole('dialog', { name: 'Seitennavigation' })
    .getByRole('button', { name: 'Rechner öffnen' })
    .click()
  await expect(page).toHaveURL(/\?view=calculator&module=joule$/)
})
