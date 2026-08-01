import { expect, test, type Locator } from '@playwright/test'

function channelToLinear(channel: number) {
  const normalized = channel / 255
  return normalized <= .04045
    ? normalized / 12.92
    : ((normalized + .055) / 1.055) ** 2.4
}

function parseRgb(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`)
  return channels
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const [red, green, blue] = parseRgb(color).map(channelToLinear)
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
  expect(contrastRatio(colors.foreground, colors.background), label).toBeGreaterThanOrEqual(4.5)
}

test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

test('light-theme primary controls meet WCAG AA contrast', async ({ page }) => {
  await page.goto('./')

  await expectNormalTextContrast(page.locator('.landing-shell__calculator-link'), 'header calculator CTA')

  await page.getByRole('button', { name: 'Navigation öffnen' }).click()
  await expectNormalTextContrast(page.locator('.floating-rail-calculator'), 'floating rail calculator CTA')
  await page.getByRole('button', { name: 'Navigation schließen' }).click()

  await page.locator('#thermodynamik').scrollIntoViewIfNeeded()
  await expectNormalTextContrast(page.locator('.thermodynamics-explorer__advance'), 'explorer advance CTA')
  await page.getByRole('button', { name: 'Thermodynamik erkunden' }).click()
  await page.getByRole('button', { name: 'Kreisprozesse erkunden' }).click()
  await page.getByRole('button', { name: 'Carnot-Prozess', exact: true }).click()
  await expectNormalTextContrast(page.locator('.thermodynamics-explorer__open'), 'explorer calculator CTA')

  await page.locator('#rechenweg').scrollIntoViewIfNeeded()
  await expectNormalTextContrast(page.locator('.joule-proof__calculator'), 'Joule proof CTA')

  await page.locator('#projekt').scrollIntoViewIfNeeded()
  await expectNormalTextContrast(page.locator('.project-coda__calculator'), 'project coda CTA')
})
