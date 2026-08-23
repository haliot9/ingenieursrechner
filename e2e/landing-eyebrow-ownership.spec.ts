import { expect, test, type Locator, type Page } from '@playwright/test'

const styleProperties = [
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'textTransform',
] as const

type StyleProperty = typeof styleProperties[number]
type EyebrowId = 'joule' | 'module' | 'project' | 'thermoDetail' | 'thermoLead'
type Theme = 'dark' | 'light'
type EyebrowStyles = Record<StyleProperty, string>

const canonicalEagerEyebrowDeclaration = {
  color: 'var(--landing-muted)',
  fontSize: '0.72rem',
  fontWeight: '800',
  letterSpacing: '0.14em',
  lineHeight: '1.4',
  margin: '0px',
  textTransform: 'uppercase',
}

const baseEyebrow: Omit<EyebrowStyles, 'color' | 'lineHeight' | 'marginBottom'> = {
  fontFamily: 'Inter, "DM Sans", ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif',
  fontSize: '11.52px',
  fontStyle: 'normal',
  fontWeight: '800',
  letterSpacing: '1.6128px',
  marginLeft: '0px',
  marginRight: '0px',
  marginTop: '0px',
  textTransform: 'uppercase',
}

const expectedStyles: Record<Theme, Record<EyebrowId, EyebrowStyles>> = {
  dark: {
    module: { ...baseEyebrow, color: 'rgb(170, 181, 197)', lineHeight: '16.128px', marginBottom: '0px' },
    thermoDetail: { ...baseEyebrow, color: 'rgb(185, 175, 170)', lineHeight: '19.008px', marginBottom: '24px' },
    thermoLead: { ...baseEyebrow, color: 'rgba(23, 25, 28, 0.72)', lineHeight: '16.128px', marginBottom: '16px' },
    joule: { ...baseEyebrow, color: 'rgb(170, 181, 197)', lineHeight: '16.128px', marginBottom: '0px' },
    project: { ...baseEyebrow, color: 'rgb(170, 181, 197)', lineHeight: '16.128px', marginBottom: '0px' },
  },
  light: {
    module: { ...baseEyebrow, color: 'rgb(101, 98, 93)', lineHeight: '16.128px', marginBottom: '0px' },
    thermoDetail: { ...baseEyebrow, color: 'rgb(116, 106, 104)', lineHeight: '19.008px', marginBottom: '24px' },
    thermoLead: { ...baseEyebrow, color: 'rgba(255, 241, 219, 0.76)', lineHeight: '16.128px', marginBottom: '16px' },
    joule: { ...baseEyebrow, color: 'rgb(101, 98, 93)', lineHeight: '16.128px', marginBottom: '0px' },
    project: { ...baseEyebrow, color: 'rgb(101, 98, 93)', lineHeight: '16.128px', marginBottom: '0px' },
  },
}

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  })
}

async function activateDeferredSection(page: Page, id: string, content: Locator) {
  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight)
  await page.evaluate(async (sectionId) => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    document.getElementById(sectionId)?.scrollIntoView({ block: 'center', behavior: 'auto' })
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    root.style.scrollBehavior = previousBehavior
  }, id)
  await expect(content).toBeVisible()
}

async function loadDeferredSections(page: Page) {
  await activateDeferredSection(page, 'module', page.locator('.module-atlas'))
  await activateDeferredSection(page, 'thermodynamik', page.locator('.thermodynamics-explorer'))
  await activateDeferredSection(page, 'rechenweg', page.locator('.joule-proof'))
  await activateDeferredSection(page, 'projekt', page.locator('.project-coda'))
  await page.locator('.thermodynamics-menu__row[data-module-id="carnot"]').click()
  await expect(page.locator('.thermodynamics-explorer__detail-copy > .landing-eyebrow')).toBeVisible()
  await waitForFonts(page)
}

async function canonicalEagerEyebrowRule(page: Page) {
  return page.evaluate(() => {
    for (const stylesheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(stylesheet.cssRules)) {
          if (!(rule instanceof CSSStyleRule) || rule.selectorText !== '.landing-eyebrow') continue

          return {
            color: rule.style.color,
            fontSize: rule.style.fontSize,
            fontWeight: rule.style.fontWeight,
            letterSpacing: rule.style.letterSpacing,
            lineHeight: rule.style.lineHeight,
            margin: rule.style.margin,
            textTransform: rule.style.textTransform,
          }
        }
      } catch {
        // A cross-origin stylesheet cannot contain this app-owned declaration.
      }
    }

    return null
  })
}

async function assertEagerEyebrowOwnership(page: Page) {
  await expect(page.locator('.module-atlas, .thermodynamics-explorer, .joule-proof, .project-coda')).toHaveCount(0)
  await expect.poll(() => canonicalEagerEyebrowRule(page)).toEqual(canonicalEagerEyebrowDeclaration)
}

async function computedStyles(locator: Locator): Promise<EyebrowStyles> {
  return locator.evaluate((element, properties) => {
    const style = getComputedStyle(element)
    return Object.fromEntries(properties.map(property => [property, style[property]]))
  }, styleProperties) as Promise<EyebrowStyles>
}

test('ships eager eyebrow ownership and preserves PRE computed styles at every shipped viewport and theme', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto('./')
    await assertEagerEyebrowOwnership(page)
    await waitForFonts(page)
    await loadDeferredSections(page)

    const eyebrows: Record<EyebrowId, Locator> = {
      module: page.locator('#module > .landing-eyebrow'),
      thermoDetail: page.locator('.thermodynamics-explorer__detail-copy > .landing-eyebrow'),
      thermoLead: page.locator('.thermodynamics-menu__lead-surface > .landing-eyebrow'),
      joule: page.locator('#rechenweg .joule-proof__header > .landing-eyebrow'),
      project: page.locator('#projekt .landing-eyebrow'),
    }
    const observedStyles = Object.fromEntries(await Promise.all(
      Object.entries(eyebrows).map(async ([name, locator]) => [name, await computedStyles(locator)]),
    )) as Record<EyebrowId, EyebrowStyles>
    expect(observedStyles).toEqual(expectedStyles[theme])
  }
})
