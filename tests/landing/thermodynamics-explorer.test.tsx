import React from 'react'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiagramSpec } from '../../src/core/types'
import { ThermodynamicsExplorer } from '../../src/landing/components/ThermodynamicsExplorer'
import { getThermodynamicsModules } from '../../src/landing/model/landing-modules'
import { computeTSRange, makeTSScales } from '../../src/utils/diagram-scales'

interface TimelineDouble {
  readonly options: Record<string, unknown>
  readonly to: ReturnType<typeof vi.fn>
  readonly call: ReturnType<typeof vi.fn>
  readonly play: ReturnType<typeof vi.fn>
  readonly reverse: ReturnType<typeof vi.fn>
  readonly pause: ReturnType<typeof vi.fn>
  readonly progress: ReturnType<typeof vi.fn>
  readonly eventCallback: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
}

interface TriggerDouble {
  readonly config: Record<string, unknown>
  readonly refresh: ReturnType<typeof vi.fn>
  readonly kill: ReturnType<typeof vi.fn>
  progress: number
  isActive: boolean
}

const scenarioBoundary = vi.hoisted(() => ({
  moduleIds: [] as string[],
  diagramSpecs: [] as Array<DiagramSpec | null>,
}))

const diagramBoundary = vi.hoisted(() => ({
  specs: [] as DiagramSpec[],
}))

vi.mock('../../src/landing/model/reference-scenario', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/landing/model/reference-scenario')>()
  return {
    ...actual,
    buildReferenceScenario(moduleId: string) {
      const scenario = actual.buildReferenceScenario(moduleId)
      scenarioBoundary.moduleIds.push(moduleId)
      scenarioBoundary.diagramSpecs.push(scenario.diagramSpec)
      return scenario
    },
  }
})

vi.mock('../../src/landing/components/LandingDiagram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/landing/components/LandingDiagram')>()
  return {
    ...actual,
    LandingDiagram({ spec }: { spec: DiagramSpec }) {
      diagramBoundary.specs.push(spec)
      return <actual.LandingDiagram spec={spec} />
    },
  }
})

const motion = vi.hoisted(() => {
  const contexts: Array<{ revert: ReturnType<typeof vi.fn> }> = []
  const timelines: TimelineDouble[] = []
  const triggers: TriggerDouble[] = []

  const gsap = {
    registerPlugin: vi.fn(),
    set: vi.fn((target: unknown, vars: Record<string, unknown>) => {
      if (target instanceof HTMLElement && typeof vars.visibility === 'string') {
        target.style.visibility = vars.visibility
      }
    }),
    to: vi.fn(() => ({ kill: vi.fn() })),
    context: vi.fn((setup: () => void) => {
      setup()
      const context = { revert: vi.fn() }
      contexts.push(context)
      return context
    }),
    timeline: vi.fn((options: Record<string, unknown>) => {
      let progressValue = 0
      const scheduledCallbacks: Array<() => void> = []
      const eventCallbacks = new Map<string, () => void>()
      const timeline = {
        options,
        to: vi.fn(() => timeline),
        call: vi.fn((callback: () => void) => {
          scheduledCallbacks.push(callback)
          return timeline
        }),
        play: vi.fn(() => {
          if (scheduledCallbacks.length > 0) {
            for (const callback of scheduledCallbacks) callback()
          } else {
            progressValue = 1
            ;(options.onComplete as (() => void) | undefined)?.()
          }
          return timeline
        }),
        reverse: vi.fn(() => {
          progressValue = 0
          eventCallbacks.get('onReverseComplete')?.()
          return timeline
        }),
        pause: vi.fn(() => timeline),
        progress: vi.fn((value?: number) => {
          if (typeof value === 'number') {
            progressValue = value
            return timeline
          }
          return progressValue
        }),
        eventCallback: vi.fn((name: string, callback: () => void) => {
          eventCallbacks.set(name, callback)
          return timeline
        }),
        kill: vi.fn(),
      }
      timelines.push(timeline)
      return timeline
    }),
  }

  const ScrollTrigger = {
    pluginName: 'ScrollTrigger',
    create: vi.fn((config: Record<string, unknown>) => {
      const trigger = {
        config,
        progress: 0,
        isActive: false,
        refresh: vi.fn(),
        kill: vi.fn(),
      }
      triggers.push(trigger)
      return trigger
    }),
    refresh: vi.fn(),
  }

  return {
    gsap,
    ScrollTrigger,
    contexts,
    timelines,
    triggers,
    reset() {
      contexts.length = 0
      timelines.length = 0
      triggers.length = 0
      vi.clearAllMocks()
    },
  }
})

vi.mock('gsap', () => ({ gsap: motion.gsap }))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: motion.ScrollTrigger }))

const FORBIDDEN_COPY = [
  'Thermodynamik erkunden',
  'Kreisprozesse erkunden',
  'Zurück',
  'Mehr erfahren',
  'Seiliger',
  'Robotik',
  'SPS',
  'Rankine',
  'Strömungsmechanik',
] as const

function row(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) })
}

beforeEach(() => {
  motion.reset()
  scenarioBoundary.moduleIds.length = 0
  scenarioBoundary.diagramSpecs.length = 0
  diagramBoundary.specs.length = 0
})

describe('ThermodynamicsExplorer', () => {
  it('renders the closed portrait tree as exactly one lead and four registry-ordered followers', () => {
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )

    const explorer = screen.getByRole('region', { name: 'Thermodynamik-Menü' })
    expect(screen.getByRole('heading', { name: 'Thermodynamik', level: 2 })).toBeInTheDocument()

    const modules = getThermodynamicsModules()
    const rows = within(explorer).getAllByRole('button')
    expect(rows).toHaveLength(modules.length)
    expect(rows.map(button => button.textContent)).toEqual(
      modules.map((module, index) => (
        `${String(index + 1).padStart(2, '0')}${module.name}Rechner verfügbar↗`
      )),
    )
    expect(rows.map(button => button.getAttribute('data-module-id'))).toEqual(
      modules.map(module => module.id),
    )
    expect(rows.every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true)
    expect(rows.every(button => !button.hasAttribute('aria-controls'))).toBe(true)
    expect(container.querySelectorAll('.thermodynamics-menu > *')).toHaveLength(5)
    expect(container.querySelectorAll('.thermodynamics-menu__lead')).toHaveLength(1)
    expect(container.querySelectorAll('.thermodynamics-menu__follower')).toHaveLength(4)
    expect(container.querySelector('[role="region"][id^="thermodynamics-detail-"]')).toBeNull()
  })

  it('opens authentic registry detail and a real reference T-s diagram without routing the row', () => {
    const onSelectionChange = vi.fn()
    const onOpenCalculator = vi.fn()
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={onSelectionChange}
        onOpenCalculator={onOpenCalculator}
      />,
    )
    const module = getThermodynamicsModules()[0]
    const moduleRow = row(module.name)

    fireEvent.click(moduleRow)

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith(module.id)
    expect(onOpenCalculator).not.toHaveBeenCalled()
    expect(moduleRow).toHaveAttribute('aria-expanded', 'true')
    const detailId = moduleRow.getAttribute('aria-controls')
    expect(detailId).toBe(`thermodynamics-detail-${module.id}`)
    const detail = screen.getByRole('region', { name: module.name })
    expect(detail).toHaveAttribute('id', detailId)
    expect(detail.previousElementSibling).toBe(moduleRow)
    expect(detail.parentElement).toHaveClass('thermodynamics-menu__follower')
    expect(within(detail).getByRole('heading', { name: module.name, level: 3 })).toBeInTheDocument()
    expect(within(detail).getByText(module.description)).toBeInTheDocument()
    const processList = within(detail).getByRole('list', { name: 'Prozessfolge' })
    expect(within(processList).getAllByRole('listitem').map(item => item.textContent)).toEqual(
      module.processSequence.map(process => `${process.transition}${process.label}`),
    )
    expect(scenarioBoundary.moduleIds).toEqual([module.id])
    expect(scenarioBoundary.diagramSpecs).toHaveLength(1)
    const scenarioSpec = scenarioBoundary.diagramSpecs[0]
    if (!scenarioSpec) throw new Error('Expected solver-backed Carnot diagram spec')
    expect(diagramBoundary.specs).toHaveLength(1)
    expect(diagramBoundary.specs[0]).toBe(scenarioSpec)

    const diagram = within(detail).getByLabelText('Referenzdiagramm')
    const svg = diagram.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(within(diagram).getByText('T-s Diagramm')).toBeInTheDocument()
    const validStatePoints = scenarioSpec.statePoints.filter(
      point => point.T !== null && point.s !== null,
    )
    const stateMarkers = within(diagram).getAllByRole('img')
    expect(stateMarkers).toHaveLength(validStatePoints.length)
    for (const [index, point] of validStatePoints.entries()) {
      expect(stateMarkers[index]).toHaveAttribute(
        'aria-label',
        expect.stringMatching(new RegExp(`^${point.label}: T = .+, s = .+, p = .+$`)),
      )
    }

    const range = computeTSRange(scenarioSpec.statePoints)
    if (!range) throw new Error('Expected plottable Carnot T-s range')
    const scales = makeTSScales(range, 480, 320, {
      left: 55,
      right: 25,
      top: 30,
      bottom: 40,
    })
    expect(Number(stateMarkers[0].getAttribute('cx'))).toBeCloseTo(
      scales.xToSVG(validStatePoints[0].s as number),
      10,
    )
    expect(Number(stateMarkers[0].getAttribute('cy'))).toBeCloseTo(
      scales.yToSVG(validStatePoints[0].T as number),
      10,
    )
    const processCurves = Array.from(
      svg?.querySelectorAll(':scope > path:not([stroke-dasharray])') ?? [],
    )
    expect(processCurves).toHaveLength(scenarioSpec.segments.length)
    expect(processCurves[0].getAttribute('d')?.match(/\bL\b/g)).toHaveLength(59)
    expect(container.querySelectorAll('.thermodynamics-menu > *')).toHaveLength(5)

    fireEvent.click(within(detail).getByRole('button', { name: 'Im Rechner öffnen' }))
    expect(onOpenCalculator).toHaveBeenCalledTimes(1)
    expect(onOpenCalculator).toHaveBeenCalledWith(module.id)
  })

  it('closes the same row without clearing, repeating, or moving its keyboard focus', () => {
    const onSelectionChange = vi.fn()
    const onOpenCalculator = vi.fn()
    render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={onSelectionChange}
        onOpenCalculator={onOpenCalculator}
      />,
    )
    const module = getThermodynamicsModules()[1]
    const moduleRow = row(module.name)

    fireEvent.click(moduleRow)
    moduleRow.focus()
    fireEvent.click(moduleRow)

    expect(screen.queryByRole('region', { name: module.name })).not.toBeInTheDocument()
    expect(moduleRow).toHaveAttribute('aria-expanded', 'false')
    expect(moduleRow).not.toHaveAttribute('aria-controls')
    expect(document.activeElement).toBe(moduleRow)
    expect(onSelectionChange.mock.calls).toEqual([[module.id]])
    expect(onOpenCalculator).not.toHaveBeenCalled()
  })

  it('moves the one live detail below a newly selected row', () => {
    const onSelectionChange = vi.fn()
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={onSelectionChange}
        onOpenCalculator={vi.fn()}
      />,
    )
    const [carnot, , diesel] = getThermodynamicsModules()

    fireEvent.click(row(carnot.name))
    fireEvent.click(row(diesel.name))

    expect(screen.queryByRole('region', { name: carnot.name })).not.toBeInTheDocument()
    const detail = screen.getByRole('region', { name: diesel.name })
    expect(detail.previousElementSibling).toBe(row(diesel.name))
    expect(container.querySelectorAll('[role="region"][id^="thermodynamics-detail-"]')).toHaveLength(1)
    expect(row(carnot.name)).toHaveAttribute('aria-expanded', 'false')
    expect(row(diesel.name)).toHaveAttribute('aria-expanded', 'true')
    expect(onSelectionChange.mock.calls).toEqual([[carnot.id], [diesel.id]])
  })

  it('refreshes the same owned trigger once for real open, move, and close revisions', async () => {
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion={false}
        onSelectionChange={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )
    await waitFor(() => expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1))
    const ownedTrigger = motion.triggers[0]
    const ownedScheduler = motion.timelines.find(timeline => timeline.call.mock.calls.length > 0)
    const controllerTimelines = motion.timelines.filter(
      timeline => timeline.to.mock.calls.length === 1,
    )
    const ownedContexts = [...motion.contexts]
    const chainItems = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.thermodynamics-menu__lead, .thermodynamics-menu__follower',
      ),
    )
    expect(ownedScheduler).toBeDefined()
    expect(controllerTimelines).toHaveLength(5)
    expect(controllerTimelines.map(timeline => (
      (timeline.to.mock.calls[0]?.[1] as { ease?: unknown } | undefined)?.ease
    ))).toEqual([
      'power3.out',
      'bounce.out',
      'bounce.out',
      'bounce.out',
      'bounce.out',
    ])
    expect(ownedContexts).toHaveLength(5)
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(1)

    act(() => { (ownedTrigger.config.onEnter as () => void)() })
    await waitFor(() => {
      expect(container.querySelector('.thermodynamics-menu')).toHaveAttribute(
        'data-elastic-menu-phase',
        'settled',
      )
    })

    const [carnot, , diesel] = getThermodynamicsModules()
    fireEvent.click(row(carnot.name))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(2)
    fireEvent.click(row(diesel.name))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(3)
    fireEvent.click(row(diesel.name))
    expect(ownedTrigger.refresh).toHaveBeenCalledTimes(4)

    expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1)
    expect(motion.ScrollTrigger.refresh).not.toHaveBeenCalled()
    expect(motion.triggers).toEqual([ownedTrigger])
    expect(motion.timelines).toEqual([...controllerTimelines, ownedScheduler])
    expect(motion.contexts).toEqual(ownedContexts)
    expect(Array.from(
      container.querySelectorAll<HTMLElement>(
        '.thermodynamics-menu__lead, .thermodynamics-menu__follower',
      ),
    )).toEqual(chainItems)
    expect(ownedTrigger.kill).not.toHaveBeenCalled()
    expect(ownedScheduler?.kill).not.toHaveBeenCalled()
    for (const timeline of controllerTimelines) expect(timeline.kill).not.toHaveBeenCalled()
    for (const context of ownedContexts) expect(context.revert).not.toHaveBeenCalled()
  })

  it('closes an open detail as soon as the real chain publishes reversing', async () => {
    render(
      <ThermodynamicsExplorer
        reducedMotion={false}
        onSelectionChange={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )
    const module = getThermodynamicsModules()[0]
    await waitFor(() => expect(motion.ScrollTrigger.create).toHaveBeenCalledTimes(1))
    const triggerConfig = motion.triggers[0].config
    act(() => { (triggerConfig.onEnter as () => void)() })

    fireEvent.click(row(module.name))
    expect(screen.getByRole('region', { name: module.name })).toBeInTheDocument()

    act(() => {
      ;(triggerConfig.onLeaveBack as () => void)()
    })

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: module.name })).not.toBeInTheDocument()
    })
  })

  it('keeps Reduced Motion static and interactive while authentic detail stays functional', () => {
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )
    fireEvent.click(row(getThermodynamicsModules()[3].name))

    const chain = container.querySelector('.thermodynamics-menu') as HTMLElement
    const animatedItems = Array.from(
      chain.querySelectorAll<HTMLElement>(
        '.thermodynamics-menu__lead, .thermodynamics-menu__follower',
      ),
    )
    expect(chain).toHaveAttribute('data-elastic-menu-phase', 'reduced')
    expect(animatedItems).toHaveLength(5)
    for (const item of animatedItems) {
      expect(item).toHaveStyle({ visibility: 'visible' })
      expect(item).not.toHaveAttribute('inert')
    }
    expect(screen.getByLabelText('Referenzdiagramm').querySelector('svg')).toBeInTheDocument()
    expect(motion.gsap.timeline).not.toHaveBeenCalled()
    expect(motion.gsap.to).not.toHaveBeenCalled()
    expect(motion.ScrollTrigger.create).not.toHaveBeenCalled()
  })

  it('contains no legacy layers, unavailable modules, or secondary detail actions', () => {
    const { container } = render(
      <ThermodynamicsExplorer
        reducedMotion
        onSelectionChange={vi.fn()}
        onOpenCalculator={vi.fn()}
      />,
    )
    fireEvent.click(row(getThermodynamicsModules()[0].name))

    for (const forbiddenCopy of FORBIDDEN_COPY) {
      expect(screen.queryByText(forbiddenCopy, { exact: false })).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Im Rechner öffnen' })).toHaveLength(1)
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(container.querySelector('[aria-label="Aktueller Pfad"]')).toBeNull()
    expect(container.querySelector('[aria-pressed]')).toBeNull()
    expect(container.querySelector('button button')).toBeNull()
  })
})
