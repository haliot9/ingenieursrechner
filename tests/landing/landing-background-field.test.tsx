import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LandingBackgroundField,
  type LandingBackgroundRendererModule,
  type LandingBackgroundRendererLoader,
} from '../../src/landing/background/LandingBackgroundField'
import type { LandingRenderFailure } from '../../src/landing/render-failure'
import type {
  LandingBackgroundRenderFrame,
  LandingBackgroundRenderer,
} from '../../src/landing/background/renderer/landing-background-renderer.types'

interface RendererRecord {
  readonly canvas: HTMLCanvasElement
  readonly frames: LandingBackgroundRenderFrame[]
  readonly loseContext: () => void
  readonly sizes: Array<readonly [number, number, number]>
  disposeCount: number
  renderCallCount: number
  resizeCallCount: number
}

interface RendererHarnessOptions {
  readonly factoryError?: unknown
  readonly disposalError?: unknown
  readonly renderError?: unknown
  readonly resizeError?: unknown
  readonly throwOnDispose?: boolean
  readonly throwOnRenderCall?: number
  readonly throwOnResizeCall?: number
}

function createRendererHarness(harnessOptions: RendererHarnessOptions = {}) {
  const records: RendererRecord[] = []
  const module: LandingBackgroundRendererModule = {
    createLandingBackgroundRenderer(host, _config, options): LandingBackgroundRenderer {
      if ('factoryError' in harnessOptions) throw harnessOptions.factoryError
      const canvas = document.createElement('canvas')
      canvas.dataset.backgroundCanvas = 'dark-particles'
      host.append(canvas)
      const record: RendererRecord = {
        canvas,
        disposeCount: 0,
        frames: [],
        loseContext: () => options?.onContextLost?.(),
        renderCallCount: 0,
        resizeCallCount: 0,
        sizes: [],
      }
      records.push(record)
      return {
        resize(width, height, dpr) {
          record.resizeCallCount += 1
          if (record.resizeCallCount === harnessOptions.throwOnResizeCall) {
            throw harnessOptions.resizeError ?? new Error(`resize failed on call ${record.resizeCallCount}`)
          }
          record.sizes.push([width, height, dpr])
        },
        render(frame) {
          record.renderCallCount += 1
          if (record.renderCallCount === harnessOptions.throwOnRenderCall) {
            throw harnessOptions.renderError ?? new Error(`render failed on call ${record.renderCallCount}`)
          }
          record.frames.push({
            elapsedSeconds: frame.elapsedSeconds,
            pointer: [frame.pointer[0], frame.pointer[1]],
          })
        },
        dispose() {
          record.disposeCount += 1
          canvas.remove()
          if (harnessOptions.throwOnDispose) {
            throw harnessOptions.disposalError ?? new Error('dispose failed')
          }
        },
      }
    },
  }
  const loader: LandingBackgroundRendererLoader = async () => module
  return { loader, module, records }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function requireSvgDescendant(root: Element, localName: string) {
  const node = [...root.querySelectorAll('*')].find(candidate => candidate.localName === localName)
  if (!node) throw new Error(`Missing SVG node ${localName}`)
  return node
}

function expectApprovedLightGlass(root: Element) {
  const glass = root.querySelector('[data-background-branch="light"][data-glass-surface]')
  if (!glass) throw new Error('Missing Light glass surface')
  const svg = glass.querySelector('svg[data-glass-filter]')
  if (!svg) throw new Error('Missing Light glass filter')
  const displacementMaps = [...svg.querySelectorAll('*')]
    .filter(candidate => candidate.localName === 'feDisplacementMap')
  const gaussianBlur = requireSvgDescendant(svg, 'feGaussianBlur')

  expect(root).toHaveAttribute('data-background-layer', 'above-wavefield')
  expect(glass).toHaveAttribute('data-glass-layer', 'above-wavefield')
  expect(glass).toHaveStyle({
    borderRadius: '28px',
    height: '80vh',
    left: '55.00000000000001%',
    top: '50%',
    width: '40vw',
  })
  expect(displacementMaps).toHaveLength(3)
  expect(displacementMaps.map(node => node.getAttribute('scale'))).toEqual([
    '-180',
    '-170',
    '-160',
  ])
  for (const displacement of displacementMaps) {
    expect(displacement).toHaveAttribute('xChannelSelector', 'R')
    expect(displacement).toHaveAttribute('yChannelSelector', 'G')
  }
  expect(gaussianBlur).toHaveAttribute('stdDeviation', '0')
  expect([...svg.querySelectorAll('*')].some(node => node.localName === 'feTurbulence')).toBe(false)
}

describe('LandingBackgroundField', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  const originalWindowDescriptors = {
    devicePixelRatio: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio'),
    innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
    innerWidth: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
  }
  let animationFrames: Map<number, FrameRequestCallback>
  let nextAnimationFrameId: number

  const restoreDescriptor = (
    target: object,
    property: PropertyKey,
    descriptor: PropertyDescriptor | undefined,
  ) => {
    if (descriptor) Object.defineProperty(target, property, descriptor)
    else Reflect.deleteProperty(target, property)
  }

  beforeEach(() => {
    animationFrames = new Map()
    nextAnimationFrameId = 1
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    window.requestAnimationFrame = vi.fn(callback => {
      const id = nextAnimationFrameId
      nextAnimationFrameId += 1
      animationFrames.set(id, callback)
      return id
    })
    window.cancelAnimationFrame = vi.fn(id => animationFrames.delete(id))
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    restoreDescriptor(document, 'visibilityState', originalVisibilityDescriptor)
    restoreDescriptor(window, 'innerWidth', originalWindowDescriptors.innerWidth)
    restoreDescriptor(window, 'innerHeight', originalWindowDescriptors.innerHeight)
    restoreDescriptor(window, 'devicePixelRatio', originalWindowDescriptors.devicePixelRatio)
    vi.restoreAllMocks()
  })

  it('renders one config-driven Light glass surface and removes the grain plane', () => {
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const { container } = render(
      <LandingBackgroundField
        theme="light"
        reducedMotion={false}
        onRenderFailure={reporter}
      />,
    )

    const root = container.querySelector('.landing-background-field')
    if (!root) throw new Error('Missing background root')
    expect(container.querySelectorAll('.landing-background-field')).toHaveLength(1)
    expect(root?.children).toHaveLength(1)
    expectApprovedLightGlass(root)
    expect(root.querySelectorAll('[data-glass-surface]')).toHaveLength(1)
    expect(root.querySelectorAll('filter')).toHaveLength(1)
    expect(root.querySelectorAll('feTurbulence')).toHaveLength(0)
    expect(root?.querySelector('canvas')).toBeNull()
    expect(root?.querySelector('[data-particle]')).toBeNull()
    expect(reporter).not.toHaveBeenCalled()
  })

  it.each([
    { source: 'loader', stage: 'loading', error: new Error('background loader failed') },
    { source: 'factory', stage: 'initialization', error: new Error('background factory failed') },
  ] as const)('reports $stage when the Dark $source fails and preserves fallback-error', async ({
    source,
    stage,
    error,
  }) => {
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const harness = createRendererHarness(source === 'factory' ? { factoryError: error } : {})
    const rendererLoader: LandingBackgroundRendererLoader = source === 'loader'
      ? () => Promise.reject(error)
      : harness.loader
    const { container } = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={rendererLoader}
        onRenderFailure={reporter}
      />,
    )
    const root = container.querySelector('.landing-background-field') as HTMLElement

    await waitFor(() => expect(root).toHaveAttribute('data-background-status', 'fallback-error'))
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({ boundary: 'background', stage, error })
    expect(harness.records).toHaveLength(0)
    expect(animationFrames).toHaveLength(0)
  })

  it('keeps the Safari fallback observable and driven by the same material config', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    )
    const { container } = render(
      <LandingBackgroundField theme="light" reducedMotion={false} />,
    )

    const glass = container.querySelector<HTMLElement>('[data-glass-surface]')
    if (!glass) throw new Error('Missing Light glass fallback')
    expect(glass).toHaveClass('landing-background-field__light-glass--fallback')
    expect(glass).toHaveAttribute('data-glass-renderer', 'fallback')
    expect(glass.style.getPropertyValue('--glass-frost')).toBe('0.08')
    expect(glass.style.getPropertyValue('--glass-saturation')).toBe('1')
    expect(glass.style.getPropertyValue('--glass-brightness')).toBe('1')
    expect(glass.style.getPropertyValue('--glass-edge-blur')).toBe('11px')
    expect(glass.style.getPropertyValue('--glass-surface-opacity')).toBe('0.93')
  })

  it('runs Light glass comparator negative controls on altered observation clones', () => {
    const { container } = render(
      <LandingBackgroundField theme="light" reducedMotion={false} />,
    )
    const root = container.querySelector('.landing-background-field')
    if (!root) throw new Error('Missing background root')
    expectApprovedLightGlass(root)

    const mutations = [
      {
        name: 'layer regression',
        apply(mutant: Element) {
          mutant.setAttribute('data-background-layer', 'below-wavefield')
        },
      },
      {
        name: 'width regression',
        apply(mutant: Element) {
          mutant.querySelector<HTMLElement>('[data-glass-surface]')?.style.setProperty('width', '60vw')
        },
      },
      {
        name: 'height regression',
        apply(mutant: Element) {
          mutant.querySelector<HTMLElement>('[data-glass-surface]')?.style.setProperty('height', '92vh')
        },
      },
      {
        name: 'radius regression',
        apply(mutant: Element) {
          mutant.querySelector<HTMLElement>('[data-glass-surface]')?.style.setProperty('border-radius', '4px')
        },
      },
      {
        name: 'distortion regression',
        apply(mutant: Element) {
          requireSvgDescendant(mutant, 'feDisplacementMap').setAttribute('scale', '-90')
        },
      },
      {
        name: 'missing displacement channel',
        apply(mutant: Element) {
          const displacements = [...mutant.querySelectorAll('*')]
            .filter(node => node.localName === 'feDisplacementMap')
          displacements.at(-1)?.remove()
        },
      },
    ] as const

    for (const mutation of mutations) {
      const mutant = root.cloneNode(true) as Element
      mutation.apply(mutant)
      expect(
        () => expectApprovedLightGlass(mutant),
        mutation.name,
      ).toThrow()
    }
  })

  it('keeps one persistent root and an exclusive theme child across Dark/Light switches', async () => {
    const harness = createRendererHarness()
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
      />,
    )
    const root = view.container.querySelector('.landing-background-field') as HTMLElement
    await waitFor(() => expect(root.querySelectorAll('canvas')).toHaveLength(1))
    expect(root.children).toHaveLength(1)
    expect(animationFrames).toHaveLength(1)

    view.rerender(
      <LandingBackgroundField
        theme="light"
        reducedMotion={false}
        rendererLoader={harness.loader}
      />,
    )
    expect(view.container.querySelector('.landing-background-field')).toBe(root)
    expect(root.children).toHaveLength(1)
    expect(root.querySelectorAll('[data-background-branch="light"][data-glass-surface]')).toHaveLength(1)
    expect(root.querySelector('canvas')).toBeNull()
    expect(animationFrames).toHaveLength(0)
    expect(harness.records[0]?.disposeCount).toBe(1)

    view.rerender(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
      />,
    )
    await waitFor(() => expect(root.querySelectorAll('canvas')).toHaveLength(1))
    expect(root.querySelector('svg')).toBeNull()
    expect(root.children).toHaveLength(1)
    expect(harness.records).toHaveLength(2)

    const liveCanvas = harness.records[1]?.canvas
    view.unmount()
    expect(liveCanvas?.isConnected).toBe(false)
    expect(animationFrames).toHaveLength(0)
    expect(harness.records[1]?.disposeCount).toBe(1)
  })

  it('does not arm Dark RAF while hidden and cancels it again on visibility loss', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    const harness = createRendererHarness()
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
      />,
    )
    await waitFor(() => expect(harness.records).toHaveLength(1))
    expect(animationFrames).toHaveLength(0)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(1)

    const [frameId, callback] = [...animationFrames.entries()][0] as [number, FrameRequestCallback]
    animationFrames.delete(frameId)
    act(() => callback(1_000))
    expect(harness.records[0]?.frames.at(-1)).toMatchObject({ elapsedSeconds: 0 })
    expect(animationFrames).toHaveLength(1)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(0)

    view.unmount()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(0)
  })

  it('never restarts a lost Dark context and disposes it on the next theme', async () => {
    const harness = createRendererHarness()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )
    const root = view.container.querySelector('.landing-background-field') as HTMLElement
    await waitFor(() => expect(harness.records).toHaveLength(1))
    expect(animationFrames).toHaveLength(1)

    act(() => harness.records[0]?.loseContext())
    expect(root).toHaveAttribute('data-background-status', 'fallback-context-lost')
    expect(animationFrames).toHaveLength(0)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    expect(animationFrames).toHaveLength(0)

    view.rerender(
      <LandingBackgroundField
        theme="light"
        reducedMotion={false}
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )
    expect(harness.records[0]?.canvas.isConnected).toBe(false)
    expect(harness.records[0]?.disposeCount).toBe(1)
    expect(reporter).not.toHaveBeenCalled()
  })

  it('reports render then disposal in causal order and preserves the terminal fallback', async () => {
    const renderError = new Error('render failed on live frame')
    const disposalError = new Error('disposal failed after render')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const harness = createRendererHarness({
      throwOnDispose: true,
      throwOnRenderCall: 2,
      renderError,
      disposalError,
    })
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )
    const root = view.container.querySelector('.landing-background-field') as HTMLElement
    await waitFor(() => expect(root).toHaveAttribute('data-background-status', 'ready'))
    expect(animationFrames).toHaveLength(1)

    const [frameId, callback] = [...animationFrames.entries()][0] as [number, FrameRequestCallback]
    animationFrames.delete(frameId)
    expect(() => act(() => callback(1_000))).not.toThrow()

    const record = harness.records[0]
    expect(root).toHaveAttribute('data-background-status', 'fallback-error')
    expect(animationFrames).toHaveLength(0)
    expect(record?.disposeCount).toBe(1)
    expect(record?.canvas.isConnected).toBe(false)
    expect(reporter.mock.calls.map(([failure]) => failure)).toEqual([
      { boundary: 'background', stage: 'render', error: renderError },
      { boundary: 'background', stage: 'disposal', error: disposalError },
    ])

    const renderCallsAtFailure = record?.renderCallCount
    const resizeCallsAtFailure = record?.resizeCallCount
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent(document, new Event('visibilitychange'))
    fireEvent(window, new Event('resize'))
    expect(animationFrames).toHaveLength(0)
    expect(record?.renderCallCount).toBe(renderCallsAtFailure)
    expect(record?.resizeCallCount).toBe(resizeCallsAtFailure)

    expect(() => view.unmount()).not.toThrow()
    expect(record?.disposeCount).toBe(1)
  })

  it('reports a live Dark resize failure and preserves the terminal latch', async () => {
    const error = new Error('live resize failed')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const harness = createRendererHarness({ throwOnResizeCall: 2, resizeError: error })
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )
    const root = view.container.querySelector('.landing-background-field') as HTMLElement
    await waitFor(() => expect(root).toHaveAttribute('data-background-status', 'ready'))
    expect(animationFrames).toHaveLength(1)

    expect(() => fireEvent(window, new Event('resize'))).not.toThrow()

    const record = harness.records[0]
    expect(root).toHaveAttribute('data-background-status', 'fallback-error')
    expect(animationFrames).toHaveLength(0)
    expect(record?.disposeCount).toBe(1)
    expect(record?.canvas.isConnected).toBe(false)
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      boundary: 'background',
      stage: 'resize',
      error,
    })

    const resizeCallsAtFailure = record?.resizeCallCount
    fireEvent(window, new Event('resize'))
    fireEvent(document, new Event('visibilitychange'))
    expect(record?.resizeCallCount).toBe(resizeCallsAtFailure)
    expect(animationFrames).toHaveLength(0)

    view.unmount()
    expect(record?.disposeCount).toBe(1)
  })

  it('reports initial Dark resize failure and disposes the renderer immediately', async () => {
    const error = new Error('initial resize failed')
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const harness = createRendererHarness({ throwOnResizeCall: 1, resizeError: error })
    const view = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion={false}
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )
    const root = view.container.querySelector('.landing-background-field') as HTMLElement

    await waitFor(() => expect(root).toHaveAttribute('data-background-status', 'fallback-error'))
    const record = harness.records[0]
    expect(record?.disposeCount).toBe(1)
    expect(record?.canvas.isConnected).toBe(false)
    expect(animationFrames).toHaveLength(0)
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith({
      boundary: 'background',
      stage: 'resize',
      error,
    })

    view.unmount()
    expect(record?.disposeCount).toBe(1)
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores a deferred loader %s after Dark switches to Light',
    async outcome => {
      const harness = createRendererHarness()
      const deferred = createDeferred<LandingBackgroundRendererModule>()
      const loader: LandingBackgroundRendererLoader = () => deferred.promise
      const view = render(
        <LandingBackgroundField theme="dark" reducedMotion={false} rendererLoader={loader} />,
      )
      const root = view.container.querySelector('.landing-background-field') as HTMLElement
      expect(root).toHaveAttribute('data-background-status', 'loading')

      view.rerender(
        <LandingBackgroundField theme="light" reducedMotion={false} rendererLoader={loader} />,
      )
      expect(root).toHaveAttribute('data-background-status', 'static')
      expect(root.querySelectorAll('[data-background-branch="light"][data-glass-surface]')).toHaveLength(1)
      expect(animationFrames).toHaveLength(0)

      await act(async () => {
        if (outcome === 'resolve') deferred.resolve(harness.module)
        else deferred.reject(new Error('deferred loader rejected'))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(harness.records).toHaveLength(0)
      expect(root).toHaveAttribute('data-background-status', 'static')
      expect(root.querySelector('canvas')).toBeNull()
      expect(root.querySelectorAll('[data-background-branch="light"][data-glass-surface]')).toHaveLength(1)
      expect(animationFrames).toHaveLength(0)
    },
  )

  it.each(['resolve', 'reject'] as const)(
    'ignores a deferred loader %s after unmount',
    async outcome => {
      const harness = createRendererHarness()
      const deferred = createDeferred<LandingBackgroundRendererModule>()
      const loader: LandingBackgroundRendererLoader = () => deferred.promise
      const view = render(
        <LandingBackgroundField theme="dark" reducedMotion={false} rendererLoader={loader} />,
      )
      const detachedRoot = view.container.querySelector('.landing-background-field') as HTMLElement
      view.unmount()

      await act(async () => {
        if (outcome === 'resolve') deferred.resolve(harness.module)
        else deferred.reject(new Error('deferred loader rejected'))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(detachedRoot.isConnected).toBe(false)
      expect(harness.records).toHaveLength(0)
      expect(view.container).toBeEmptyDOMElement()
      expect(animationFrames).toHaveLength(0)
    },
  )

  it('draws one static Dark frame under Reduced Motion without an autonomous loop', async () => {
    const harness = createRendererHarness()
    const reporter = vi.fn<(failure: LandingRenderFailure) => void>()
    const { container, unmount } = render(
      <LandingBackgroundField
        theme="dark"
        reducedMotion
        rendererLoader={harness.loader}
        onRenderFailure={reporter}
      />,
    )

    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    expect(harness.records[0]?.frames).toEqual([{
      elapsedSeconds: 0,
      pointer: [0, 0],
    }])
    expect(animationFrames).toHaveLength(0)

    fireEvent.pointerMove(window, { clientX: 1440, clientY: 0 })
    fireEvent(window, new Event('resize'))
    expect(harness.records[0]?.frames).toEqual([
      { elapsedSeconds: 0, pointer: [0, 0] },
      { elapsedSeconds: 0, pointer: [0, 0] },
    ])
    expect(animationFrames).toHaveLength(0)

    unmount()
    expect(harness.records[0]?.canvas.isConnected).toBe(false)
    expect(harness.records[0]?.disposeCount).toBe(1)
    expect(reporter).not.toHaveBeenCalled()
  })
})
