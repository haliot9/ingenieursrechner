import { expect, test, type Locator, type Page } from '@playwright/test'
import { elasticMenuChainConfig } from '../src/landing/motion/config/elastic-menu-chain-config.generated'

const swiftShaderLaunchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}

interface ElasticMenuDomObservation {
  entryCount: number
  labels: string[]
  phase: string
  startTimeMs: Array<number | null>
}

interface ElasticMenuJourneyEvidence {
  readonly autonomous: boolean
  readonly canvasCount: number
}

test.use({ launchOptions: swiftShaderLaunchOptions })

function collectRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function holdMagneticLanding(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 7521,
    }))
    document.documentElement.style.scrollBehavior = 'auto'
  })
}

async function releaseMagneticLanding(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 7521,
    }))
  }).catch(() => undefined)
}

async function scrollWithoutSmoothing(page: Page, top: number) {
  await page.evaluate((target) => {
    window.scrollTo({ top: target, behavior: 'auto' })
  }, Math.max(0, top))
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function loadChainBeforeEntry(page: Page) {
  await page.goto('./')
  await expect(page.locator('.landing-shell')).toBeVisible()
  await holdMagneticLanding(page)

  const thermodynamics = page.locator('#thermodynamik')
  const chapterTop = await thermodynamics.evaluate(element => (
    element.getBoundingClientRect().top + window.scrollY
  ))
  const viewportHeight = page.viewportSize()?.height ?? 900
  await scrollWithoutSmoothing(page, chapterTop - viewportHeight - 320)

  const chain = page.locator('.thermodynamics-menu')
  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'initial')
  await expect(chain.locator('.thermodynamics-menu__lead')).toHaveCount(1)
  await expect(chain.locator('.thermodynamics-menu__follower')).toHaveCount(4)
  await installChainDomObserver(chain)
  return chain
}

async function installChainDomObserver(chain: Locator) {
  await chain.evaluate((element) => {
    const root = element as HTMLElement
    const wrappers = Array.from(root.children) as HTMLElement[]
    const labels = wrappers.map(wrapper => (
      wrapper.querySelector('h2, strong')?.textContent?.trim() ?? ''
    ))
    const entries: Array<Array<number | null>> = []
    let previousPhase = root.getAttribute('data-elastic-menu-phase')

    const syncPhase = () => {
      const phase = root.getAttribute('data-elastic-menu-phase')
      if (phase === previousPhase) return phase
      if (phase === 'entering' && previousPhase === 'initial') {
        entries.push(Array.from({ length: wrappers.length }, () => null))
      }
      previousPhase = phase
      return phase
    }

    const observer = new MutationObserver((records) => {
      const phase = syncPhase()
      if (phase !== 'entering' || entries.length === 0) return
      const currentStarts = entries[entries.length - 1]
      for (const record of records) {
        if (record.attributeName !== 'style') continue
        const index = wrappers.indexOf(record.target as HTMLElement)
        if (index < 0 || currentStarts[index] !== null) continue
        currentStarts[index] = performance.now()
      }
    })
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-elastic-menu-phase', 'style'],
      subtree: true,
    })

    const testWindow = window as typeof window & {
      __elasticMenuChainDomObserver?: {
        disconnect(): void
        snapshot(): ElasticMenuDomObservation
      }
    }
    testWindow.__elasticMenuChainDomObserver?.disconnect()
    testWindow.__elasticMenuChainDomObserver = {
      disconnect: () => observer.disconnect(),
      snapshot: () => {
        syncPhase()
        return {
          entryCount: entries.length,
          labels: [...labels],
          phase: root.getAttribute('data-elastic-menu-phase') ?? '',
          startTimeMs: [...(entries.at(-1) ?? wrappers.map(() => null))],
        }
      },
    }
  })
}

async function chainBoundary(page: Page, kind: 'entry' | 'exit' | 'restore') {
  return page.locator('.thermodynamics-menu').evaluate((element, requested) => {
    const rect = element.getBoundingClientRect()
    const top = rect.top + window.scrollY
    if (requested.kind === 'entry') {
      return top - window.innerHeight * (1 - requested.threshold)
    }
    const bottom = top + rect.height
    return requested.kind === 'exit'
      ? bottom - window.innerHeight * .18
      : bottom - window.innerHeight * .36
  }, { kind, threshold: elasticMenuChainConfig.chain.threshold })
}

async function reverseAsSoonAsExitStarts(page: Page, exit: number, restore: number) {
  await page.locator('.thermodynamics-menu').evaluate(async (element, targets) => {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('The menu never entered its exiting phase'))
      }, 2_000)
      const observer = new MutationObserver(() => {
        if (element.getAttribute('data-elastic-menu-phase') !== 'exiting') return
        observer.disconnect()
        window.clearTimeout(timeout)
        window.scrollTo({ top: targets.restore, behavior: 'auto' })
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      observer.observe(element, { attributes: true, attributeFilter: ['data-elastic-menu-phase'] })
      window.scrollTo({ top: targets.exit, behavior: 'auto' })
    })
  }, { exit, restore })
}

async function readDomObservation(page: Page) {
  return page.evaluate(() => {
    const observer = (window as typeof window & {
      __elasticMenuChainDomObserver?: {
        snapshot(): ElasticMenuDomObservation
      }
    }).__elasticMenuChainDomObserver
    if (!observer) throw new Error('Test-owned elastic menu DOM observer is unavailable')
    return observer.snapshot()
  })
}

function expectMotionAuthority(snapshot: ElasticMenuDomObservation) {
  expect(snapshot.labels).toEqual([
    'Thermodynamik',
    'Carnot-Prozess',
    'Otto-Prozess',
    'Diesel-Prozess',
    'Joule-/Brayton-Prozess',
  ])
  const starts = snapshot.startTimeMs
  expect(starts.every((value): value is number => typeof value === 'number')).toBe(true)
  for (let index = 1; index < starts.length; index += 1) {
    expect(starts[index], `item ${index + 1} must start after item ${index}`).toBeGreaterThan(
      starts[index - 1] as number,
    )
  }
}

async function expectRealTsDiagram(detail: Locator) {
  const diagram = detail.getByLabel('Referenzdiagramm')
  await expect(diagram.locator('svg')).toHaveCount(1)

  const stateMarkers = diagram.locator('svg circle[role="img"]')
  await expect(stateMarkers).toHaveCount(4)
  const stateLabels = await stateMarkers.evaluateAll(markers => (
    markers.map(marker => marker.getAttribute('aria-label') ?? '')
  ))
  expect(stateLabels.every(label => (
    label.includes('T =') && label.includes('s =') && label.includes('p =')
  ))).toBe(true)

  const processCurves = diagram.locator('svg > path[fill="none"]:not([stroke-dasharray])')
  await expect(processCurves).toHaveCount(4)
  expect(await processCurves.evaluateAll(paths => paths.map(path => (
    path.getAttribute('d')?.match(/\bL\b/g)?.length ?? 0
  )))).toEqual([59, 59, 59, 59])
}

async function expectMenuExcludedFromTabOrder(page: Page) {
  const tabState = await page.locator('.thermodynamics-menu__row').evaluateAll(buttons => (
    buttons.map(button => ({
      inertAncestor: Boolean(button.closest('[inert]')),
      tabIndex: (button as HTMLButtonElement).tabIndex,
    }))
  ))
  expect(tabState).toHaveLength(4)
  expect(tabState.every(state => state.inertAncestor && state.tabIndex === 0)).toBe(true)
}

async function runLifecycleJourney(page: Page): Promise<ElasticMenuJourneyEvidence> {
  const chain = await loadChainBeforeEntry(page)
  await expectMenuExcludedFromTabOrder(page)

  await page.evaluate(() => {
    const state = { count: 0 }
    window.addEventListener('scroll', () => { state.count += 1 }, { passive: true })
    ;(window as typeof window & { __elasticMenuScrollAudit?: { count: number } })
      .__elasticMenuScrollAudit = state
  })

  await scrollWithoutSmoothing(page, await chainBoundary(page, 'entry') + 16)
  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'entering')
  const stopped = await page.evaluate(() => ({
    events: (window as typeof window & { __elasticMenuScrollAudit?: { count: number } })
      .__elasticMenuScrollAudit?.count ?? -1,
    scrollY: window.scrollY,
  }))

  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled', { timeout: 12_000 })
  const afterSettle = await page.evaluate(() => ({
    events: (window as typeof window & { __elasticMenuScrollAudit?: { count: number } })
      .__elasticMenuScrollAudit?.count ?? -2,
    scrollY: window.scrollY,
  }))
  const settled = await readDomObservation(page)
  expectMotionAuthority(settled)
  expect(settled.entryCount).toBe(1)
  expect(await chain.locator('[inert]').count()).toBe(0)

  const field = page.locator('.landing-line-field')
  await expect(field.locator('.landing-line-field__renderer-host canvas')).toHaveCount(1, {
    timeout: 20_000,
  })
  const identities = await page.evaluate(() => {
    const root = document.querySelector('.landing-line-field') as HTMLElement | null
    const canvas = root?.querySelector('canvas') as HTMLCanvasElement | null
    if (!root || !canvas) throw new Error('Expected one live Wavefield root and canvas')
    root.dataset.elasticMenuEvidenceId = crypto.randomUUID()
    canvas.dataset.elasticMenuEvidenceId = crypto.randomUUID()
    return {
      canvas: canvas.dataset.elasticMenuEvidenceId,
      root: root.dataset.elasticMenuEvidenceId,
    }
  })

  const exit = await chainBoundary(page, 'exit')
  const restore = await chainBoundary(page, 'restore')
  await reverseAsSoonAsExitStarts(page, exit, restore)
  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled')
  expect((await readDomObservation(page)).entryCount).toBe(1)

  for (let cycle = 1; cycle < 5; cycle += 1) {
    await scrollWithoutSmoothing(page, exit)
    await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'exited')
    await scrollWithoutSmoothing(page, restore)
    await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled')
    expect((await readDomObservation(page)).entryCount).toBe(1)
  }

  await scrollWithoutSmoothing(page, exit)
  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'exited')
  await expectMenuExcludedFromTabOrder(page)
  await scrollWithoutSmoothing(page, restore)
  await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled')
  const restored = await readDomObservation(page)
  expect(restored.entryCount).toBe(1)
  expectMotionAuthority(restored)

  const finalIdentity = await page.evaluate(() => {
    const roots = document.querySelectorAll('.landing-line-field')
    const canvases = document.querySelectorAll('.landing-line-field__renderer-host canvas')
    return {
      canvas: (canvases[0] as HTMLCanvasElement | undefined)?.dataset.elasticMenuEvidenceId,
      canvasCount: canvases.length,
      root: (roots[0] as HTMLElement | undefined)?.dataset.elasticMenuEvidenceId,
      rootCount: roots.length,
    }
  })
  expect(finalIdentity).toEqual({ ...identities, canvasCount: 1, rootCount: 1 })

  return {
    autonomous: stopped.events === afterSettle.events && stopped.scrollY === afterSettle.scrollY,
    canvasCount: finalIdentity.canvasCount,
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} elastic menu lifecycle`, () => {
    test.use({ colorScheme, reducedMotion: 'no-preference' })

    test('finishes causally without scroll and survives five last-event-wins loops', async ({ page }) => {
      const runtimeErrors = collectRuntimeErrors(page)
      try {
        const evidence = await runLifecycleJourney(page)
        expect(evidence.autonomous).toBe(true)
        expect(evidence.canvasCount).toBe(1)
        expect(runtimeErrors).toEqual([])
      } finally {
        await releaseMagneticLanding(page)
      }
    })
  })
}

test.describe('owner revision reverse, rearm, replay, and inline geometry', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('@owner-revision preserves one chain and Wavefield through reverse/re-entry/replay', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    const runtimeErrors = collectRuntimeErrors(page)
    const mobile = testInfo.project.name === 'mobile-chromium'
    await page.emulateMedia({
      colorScheme: mobile ? 'light' : 'dark',
      reducedMotion: 'no-preference',
    })

    try {
      const chain = await loadChainBeforeEntry(page)
      const directItems = chain.locator(':scope > *')
      await expect(directItems).toHaveCount(5)

      const entryBoundary = await chainBoundary(page, 'entry')
      await scrollWithoutSmoothing(page, entryBoundary + 16)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'entering')
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled', { timeout: 12_000 })
      expect((await readDomObservation(page)).entryCount).toBe(1)

      const geometry = await chain.evaluate((element, expectedIndent) => {
        const lead = element.querySelector('.thermodynamics-menu__lead')
        const leadHeading = element.querySelector('.thermodynamics-menu__lead-surface h2')
        const followers = Array.from(element.querySelectorAll('.thermodynamics-menu__follower'))
        const rows = Array.from(element.querySelectorAll('.thermodynamics-menu__row'))
        if (!(lead instanceof HTMLElement)
          || !(leadHeading instanceof HTMLElement)
          || followers.length !== 4
          || rows.length !== 4
          || followers.some(follower => !(follower instanceof HTMLElement))
          || rows.some(row => !(row instanceof HTMLElement))) {
          throw new Error('The owner-revision menu geometry is unavailable')
        }
        const leadRect = lead.getBoundingClientRect()
        const rowRects = rows.map(row => row.getBoundingClientRect())
        const documentRoot = document.documentElement
        const rootRem = Number.parseFloat(getComputedStyle(documentRoot).fontSize)
        const menuRowGap = Number.parseFloat(getComputedStyle(element).rowGap)
        return {
          acceptedFirstRowGap: rootRem * 2.5 + menuRowGap,
          expectedIndent,
          firstRowGap: rowRects[0].top - leadRect.bottom,
          headingClientWidth: leadHeading.clientWidth,
          headingScrollWidth: leadHeading.scrollWidth,
          headingWhiteSpace: getComputedStyle(leadHeading).whiteSpace,
          horizontalOverflow: documentRoot.scrollWidth - documentRoot.clientWidth,
          indents: rowRects.map(rect => rect.left - leadRect.left),
          leadHeight: leadRect.height,
          leadWidth: leadRect.width,
          menuWidth: element.getBoundingClientRect().width,
        }
      }, mobile ? 28 : 132)
      expect(Math.abs(geometry.leadWidth - geometry.menuWidth)).toBeLessThanOrEqual(1)
      expect(geometry.leadWidth).toBeGreaterThan(geometry.leadHeight)
      for (const indent of geometry.indents) {
        expect(Math.abs(indent - geometry.expectedIndent)).toBeLessThanOrEqual(1)
      }
      expect(geometry.firstRowGap).toBeGreaterThan(0)
      expect(Math.abs(geometry.firstRowGap - geometry.acceptedFirstRowGap)).toBeLessThanOrEqual(1)
      expect(geometry.headingWhiteSpace).toBe('nowrap')
      expect(geometry.headingScrollWidth).toBeLessThanOrEqual(geometry.headingClientWidth)
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0)

      const field = page.locator('.landing-line-field')
      await expect(field).toHaveCount(1)
      await expect(field.locator('.landing-line-field__renderer-host canvas')).toHaveCount(1, {
        timeout: 20_000,
      })
      const identities = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.thermodynamics-menu > *'))
        const root = document.querySelector('.landing-line-field') as HTMLElement | null
        const canvas = root?.querySelector('canvas') as HTMLCanvasElement | null
        if (items.length !== 5 || !root || !canvas) {
          throw new Error('Expected five chain items and one live Wavefield root/canvas')
        }
        const itemTokens = items.map((item) => {
          const token = crypto.randomUUID()
          ;(item as HTMLElement).dataset.ownerRevisionEvidenceId = token
          return token
        })
        root.dataset.ownerRevisionEvidenceId = crypto.randomUUID()
        canvas.dataset.ownerRevisionEvidenceId = crypto.randomUUID()
        return {
          canvas: canvas.dataset.ownerRevisionEvidenceId,
          items: itemTokens,
          root: root.dataset.ownerRevisionEvidenceId,
        }
      })

      const initialUrl = page.url()
      const carnot = chain.locator('.thermodynamics-menu__row[data-module-id="carnot"]')
      await carnot.click()
      await expect(carnot).toHaveAttribute('aria-expanded', 'true')
      const carnotDetail = page.getByRole('region', { name: 'Carnot-Prozess' })
      await expect(carnotDetail).toBeVisible()
      await expectRealTsDiagram(carnotDetail)
      expect(page.url()).toBe(initialUrl)

      const diesel = chain.locator('.thermodynamics-menu__row[data-module-id="diesel"]')
      await diesel.click()
      await expect(carnot).toHaveAttribute('aria-expanded', 'false')
      await expect(carnotDetail).toHaveCount(0)
      await expect(diesel).toHaveAttribute('aria-expanded', 'true')
      const dieselDetail = page.getByRole('region', { name: 'Diesel-Prozess' })
      await expect(dieselDetail).toBeVisible()
      await expect(chain.locator('[role="region"]')).toHaveCount(1)
      expect(await diesel.evaluate(element => element.nextElementSibling?.id)).toBe(
        'thermodynamics-detail-diesel',
      )
      await expectRealTsDiagram(dieselDetail)
      expect(page.url()).toBe(initialUrl)

      const reverseBoundary = await chainBoundary(page, 'entry')
      await scrollWithoutSmoothing(page, reverseBoundary - 16)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'reversing')
      await expect(dieselDetail).toHaveCount(0)
      await expect(diesel).toHaveAttribute('aria-expanded', 'false')

      // Re-enter while reverse is incomplete: the same owned timelines continue forward.
      await scrollWithoutSmoothing(page, reverseBoundary + 16)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled', { timeout: 12_000 })
      expect((await readDomObservation(page)).entryCount).toBe(1)

      // A complete upper crossing must finish without any additional scroll input.
      const fullReverseBoundary = await chainBoundary(page, 'entry')
      await scrollWithoutSmoothing(page, fullReverseBoundary - 16)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'reversing')
      const stoppedScrollY = await page.evaluate(() => window.scrollY)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'initial', { timeout: 12_000 })
      expect(Math.abs(await page.evaluate(() => window.scrollY) - stoppedScrollY)).toBeLessThanOrEqual(1)
      const initial = await readDomObservation(page)
      expect(initial.phase).toBe('initial')
      expect(initial.entryCount).toBe(1)

      const replayBoundary = await chainBoundary(page, 'entry')
      await scrollWithoutSmoothing(page, replayBoundary + 16)
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'entering')
      await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'settled', { timeout: 12_000 })
      const replayed = await readDomObservation(page)
      expect(replayed.entryCount).toBe(2)
      expectMotionAuthority(replayed)

      const finalIdentity = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.thermodynamics-menu > *'))
        const roots = document.querySelectorAll('.landing-line-field')
        const canvases = document.querySelectorAll('.landing-line-field__renderer-host canvas')
        return {
          canvas: (canvases[0] as HTMLCanvasElement | undefined)?.dataset.ownerRevisionEvidenceId,
          canvasCount: canvases.length,
          items: items.map(item => (item as HTMLElement).dataset.ownerRevisionEvidenceId),
          itemCount: items.length,
          root: (roots[0] as HTMLElement | undefined)?.dataset.ownerRevisionEvidenceId,
          rootCount: roots.length,
        }
      })
      expect(finalIdentity).toEqual({
        ...identities,
        canvasCount: 1,
        itemCount: 5,
        rootCount: 1,
      })
      expect(runtimeErrors).toEqual([])
    } finally {
      await releaseMagneticLanding(page)
    }
  })
})

test.describe('Reduced Motion elastic menu', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  test('is settled before paint and interactive without visible motion', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const samples: Array<{ opacity: string[]; phase: string | null; transform: string[] }> = []
      const observer = new MutationObserver(() => {
        const root = document.querySelector('.thermodynamics-menu')
        if (!root || samples.length > 0) return
        const wrappers = Array.from(root.children) as HTMLElement[]
        samples.push({
          opacity: wrappers.map(element => getComputedStyle(element).opacity),
          phase: root.getAttribute('data-elastic-menu-phase'),
          transform: wrappers.map(element => getComputedStyle(element).transform),
        })
        observer.disconnect()
      })
      observer.observe(document, { childList: true, subtree: true })
      ;(window as typeof window & { __elasticMenuFirstPaint?: typeof samples })
        .__elasticMenuFirstPaint = samples
    })

    await page.goto('./')
    const placeholder = page.locator('#thermodynamik')
    await placeholder.evaluate(element => element.scrollIntoView({ behavior: 'auto', block: 'center' }))

    const chain = page.locator('.thermodynamics-menu')
    await expect(chain).toHaveAttribute('data-elastic-menu-phase', 'reduced')
    await expect(chain.locator('.thermodynamics-menu__lead, .thermodynamics-menu__follower')).toHaveCount(5)
    await expect(chain.locator('.thermodynamics-menu__row')).toHaveCount(4)
    expect(await chain.locator('[inert]').count()).toBe(0)

    const firstPaint = await page.evaluate(() => (
      (window as typeof window & {
        __elasticMenuFirstPaint?: Array<{
          opacity: string[]
          phase: string | null
          transform: string[]
        }>
      }).__elasticMenuFirstPaint
    ))
    expect(firstPaint).toEqual([{
      opacity: ['1', '1', '1', '1', '1'],
      phase: 'reduced',
      transform: ['none', 'none', 'none', 'none', 'none'],
    }])
  })
})
