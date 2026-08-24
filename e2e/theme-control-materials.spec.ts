import { expect, test, type Locator } from '@playwright/test'

async function readMaterial(control: Locator) {
  return control.evaluate(element => {
    const shell = element.querySelector<HTMLElement>('.theme-transition-control__shell')!
    const label = element.querySelector<HTMLElement>('.theme-transition-control__label')!
    const icon = element.querySelector<HTMLElement>('.theme-transition-control__icon')!
    const shellStyle = getComputedStyle(shell)
    const labelStyle = getComputedStyle(label)
    const iconStyle = getComputedStyle(icon)

    return {
      shellBackgroundImage: shellStyle.backgroundImage,
      shellBackdrop: shellStyle.backdropFilter
        || shellStyle.getPropertyValue('-webkit-backdrop-filter'),
      labelBackgroundImage: labelStyle.backgroundImage,
      labelBackgroundClip: labelStyle.backgroundClip
        || labelStyle.getPropertyValue('-webkit-background-clip'),
      labelFontStyle: labelStyle.fontStyle,
      iconColor: iconStyle.color,
      iconTextShadow: iconStyle.textShadow,
    }
  })
}

test('theme destinations share the approved metallic and frost-glass materials', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.goto('./')

  const headerControl = page.locator('.theme-transition-control[data-variant="header"]')
  await expect(headerControl).toHaveAttribute('data-theme', 'light')

  const platinumDestination = await readMaterial(headerControl)
  expect(platinumDestination.labelFontStyle).toMatch(/italic|oblique/)
  expect(platinumDestination.labelBackgroundImage).not.toBe('none')
  expect(platinumDestination.labelBackgroundClip).toBe('text')

  await headerControl.click()
  await expect(headerControl).toHaveAttribute('data-theme', 'dark')
  await expect(headerControl).toHaveAttribute('data-phase', 'idle')

  const bronzeDestination = await readMaterial(headerControl)
  expect(bronzeDestination.shellBackgroundImage).not.toBe('none')
  expect(bronzeDestination.shellBackdrop).toContain('blur(16px)')
  expect(bronzeDestination.labelFontStyle).toMatch(/italic|oblique/)
  expect(bronzeDestination.labelBackgroundImage).not.toBe('none')
  expect(bronzeDestination.labelBackgroundClip).toBe('text')
  expect(bronzeDestination.iconColor).toBe('rgb(244, 222, 170)')
  expect(bronzeDestination.iconTextShadow).not.toBe('none')

  await page.getByRole('button', { name: 'Navigation öffnen' }).click()
  const railControl = page.getByRole('dialog').locator(
    '.theme-transition-control[data-variant="rail"]',
  )
  const railDestination = await readMaterial(railControl)

  expect(railDestination).toEqual(bronzeDestination)
})
