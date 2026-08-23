import { describe, expect, it } from 'vitest'
import type { DiagramSpec } from '../../src/core/types'
import { buildReferenceScenario } from '../../src/landing/model/reference-scenario'
import { carnotModule } from '../../src/modules/carnot'
import { useCalculatorStore } from '../../src/store/calculator-store'

const positiveReferenceContracts = [
  {
    moduleId: 'carnot',
    units: { T1: 'K', T3: 'K', p2: 'Pa', p3: 'Pa', Rs: 'J/(kg*K)', kappa: '' },
    stateIds: ['1', '2', '3', '4'],
    endpoints: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '1']],
    processTypes: ['adiabatic', 'isothermal', 'adiabatic', 'isothermal'],
  },
  {
    moduleId: 'otto',
    units: { T1: 'K', p1: 'Pa', r: '', T3: 'K', kappa: '', Rs: 'J/(kg*K)' },
    stateIds: ['1', '2', '3', '4'],
    endpoints: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '1']],
    processTypes: ['adiabatic', 'isochoric', 'adiabatic', 'isochoric'],
  },
  {
    moduleId: 'diesel',
    units: { T1: 'K', p1: 'Pa', r: '', rho_cutoff: '', kappa: '', Rs: 'J/(kg*K)' },
    stateIds: ['1', '2', '3', '4'],
    endpoints: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '1']],
    processTypes: ['adiabatic', 'isobaric', 'adiabatic', 'isochoric'],
  },
  {
    moduleId: 'joule',
    units: { T1: 'K', p1: 'Pa', pressureRatio: '', T3: 'K', kappa: '', Rs: 'J/(kg*K)' },
    stateIds: ['1', '2', '3', '4'],
    endpoints: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '1']],
    processTypes: ['adiabatic', 'isobaric', 'adiabatic', 'isobaric'],
  },
] as const

const carnotReferencePreset = () => {
  const preset = carnotModule.presets?.find(candidate => candidate.id === 'reference-air')
  if (!preset) throw new Error('Carnot reference-air test fixture is unavailable')
  return preset
}

const requireCarnotDiagramAdapter = () => {
  const adapter = carnotModule.getDiagramSpec
  if (!adapter) throw new Error('Carnot diagram test fixture is unavailable')
  return adapter
}

describe('buildReferenceScenario', () => {
  it.each(positiveReferenceContracts)(
    'publishes the literal landing T-s contract for $moduleId',
    ({ moduleId, units, stateIds, endpoints, processTypes }) => {
      const scenario = buildReferenceScenario(moduleId)
      const actualUnits = Object.fromEntries(
        Object.keys(units).map(id => [id, scenario.values[id]?.unit]),
      )

      expect(actualUnits).toEqual(units)
      expect(scenario.diagramSpec.statePoints.map(point => point.id)).toEqual(stateIds)
      expect(scenario.diagramSpec.segments.map(segment => [segment.from, segment.to])).toEqual(
        endpoints,
      )
      expect(scenario.diagramSpec.segments.map(segment => segment.processType)).toEqual(
        processTypes,
      )
    },
  )

  it('rejects every unknown preset key before solve', () => {
    const preset = carnotReferencePreset()
    preset.values.T_typo = 275
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Unknown reference-air preset variable "T_typo" in module "carnot"',
      )
    } finally {
      delete preset.values.T_typo
    }
  })

  it('preserves a declared dimensionless empty unit', () => {
    expect(buildReferenceScenario('carnot').values.kappa?.unit).toBe('')
  })

  it('requires a landing diagram adapter', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = undefined
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Missing landing diagram adapter for module "carnot"',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('rejects a null landing diagram', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = () => null
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Landing diagram unavailable for module "carnot"',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('rejects a non-finite landing T-s state', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return {
        ...spec,
        statePoints: spec.statePoints.map(point => (
          point.id === '4' ? { ...point, s: null } : point
        )),
      }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": state "4" must have finite T and s',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('requires exactly four unique landing states', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return { ...spec, statePoints: spec.statePoints.slice(0, 3) }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": expected exactly four states, received 3',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }

    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return {
        ...spec,
        statePoints: spec.statePoints.map(point => (
          point.id === '4' ? { ...point, id: '3' } : point
        )),
      }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": state IDs must be unique',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('rejects a segment endpoint that has no landing state', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return {
        ...spec,
        segments: spec.segments.map((segment, index) => (
          index === 3 ? { ...segment, to: 'missing-state' } : segment
        )),
      }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": segment "4-missing-state" references missing state "missing-state"',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('requires one connected four-state landing cycle', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return {
        ...spec,
        segments: [
          { ...spec.segments[0], from: '1', to: '2' },
          { ...spec.segments[1], from: '2', to: '1' },
          { ...spec.segments[2], from: '3', to: '4' },
          { ...spec.segments[3], from: '4', to: '3' },
        ],
      }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": segments must form one connected four-state cycle',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('rejects a segment-bound flow location that has no landing segment', () => {
    const adapter = requireCarnotDiagramAdapter()
    carnotModule.getDiagramSpec = values => {
      const spec = adapter(values) as DiagramSpec
      return {
        ...spec,
        energyFlows: spec.energyFlows.map((flow, index) => (
          index === 0 ? { ...flow, location: 'missing-edge' } : flow
        )),
      }
    }
    try {
      expect(() => buildReferenceScenario('carnot')).toThrow(
        'Invalid landing T-s diagram for module "carnot": flow "q_{zu}" references missing segment "missing-edge"',
      )
    } finally {
      carnotModule.getDiagramSpec = adapter
    }
  })

  it('preserves the complete Joule reference story', () => {
    expect(buildReferenceScenario('joule').story).toMatchObject({ mode: 'complete' })
  })

  it('does not change the active calculator module', () => {
    const activeModuleId = useCalculatorStore.getState().activeModuleId

    buildReferenceScenario('joule')

    expect(useCalculatorStore.getState().activeModuleId).toBe(activeModuleId)
  })
})
