import { describe, it, expect } from 'vitest'
import { solve, formatNumber } from '../../src/core/solver'
import { FormulaRegistry } from '../../src/core/formula-registry'
import { carnotModule } from '../../src/modules/carnot'
import type { Formula, Variable, VariableState } from '../../src/core/types'

// ─── Carnot cycle state convention used in this module ──────────────────────
//
//  Process:  1 →[adiabat]→ 2 →[isotherm heiß]→ 3 →[adiabat]→ 4 →[isotherm kalt]→ 1
//
//  T1 = T4 = T_kalt  (kalte Isotherme 4→1)
//  T2 = T3 = T_warm  (heiße Isotherme 2→3)
//
//  η = 1 - T1 / T3
//
// ─────────────────────────────────────────────────────────────────────────────

describe('Solver', () => {
  const registry = FormulaRegistry.fromModule(carnotModule)

  function makeInput(id: string, value: number, unit: string = ''): VariableState {
    return { value, unit, isUserInput: true, isComputed: false }
  }

  it('should solve ideal gas law for temperature', () => {
    // Given: p1 = 100000 Pa, V1 = 0.1 m³, m = 1 kg, Rs = 287 J/(kg·K)
    // Expected: T1 = p1 * V1 / (m * Rs) = 100000 * 0.1 / (1 * 287) ≈ 34.843 K
    const inputs: Record<string, VariableState> = {
      p1: makeInput('p1', 100000, 'Pa'),
      V1: makeInput('V1', 0.1, 'm^3'),
      m: makeInput('m', 1, 'kg'),
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
    }

    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['T1']?.value).toBeCloseTo(100000 * 0.1 / (1 * 287), 2)
    expect(result.values['T1']?.isComputed).toBe(true)
    expect(result.steps.length).toBeGreaterThan(0)
    expect(result.steps[0].targetVariable).toBe('T1')
  })

  it('should chain-solve: Mayer relation derives cp from cv and Rs', () => {
    const inputs: Record<string, VariableState> = {
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
      cv: makeInput('cv', 717.5, 'J/(kg*K)'),
    }

    const result = solve(registry, carnotModule.variables, inputs)

    // From Mayer: cp = cv + Rs = 717.5 + 287 = 1004.5
    expect(result.values['cp']?.value).toBeCloseTo(1004.5, 1)
    // From kappa_def: kappa = cp/cv = 1004.5/717.5 ≈ 1.4
    expect(result.values['kappa']?.value).toBeCloseTo(1.4, 2)
  })

  it('should compute Carnot efficiency from temperatures', () => {
    // Convention: T1 = T_kalt = 300 K, T3 = T_warm = 600 K
    // η = 1 - T1/T3 = 1 - 300/600 = 0.5
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 300, 'K'),
      T3: makeInput('T3', 600, 'K'),
    }

    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['eta']?.value).toBeCloseTo(0.5, 4)
    expect(result.values['eta']?.isComputed).toBe(true)
  })

  it('should compute first law energy balance', () => {
    // Sign convention: q_out < 0 (heat leaves system), w_netto < 0 (work output)
    // w_netto = -(q_in + q_out) = -(1000 + (-400)) = -600
    // eta    = -w_netto / q_in  = 600 / 1000       = 0.6
    const inputs: Record<string, VariableState> = {
      q_in:  makeInput('q_in',  1000, 'J/kg'),
      q_out: makeInput('q_out', -400, 'J/kg'),  // negative: heat leaving the system
    }

    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['w_netto']?.value).toBeCloseTo(-600, 4)  // negative: work output
    // eta = -w_netto/q_in = 600/1000 = 0.6
    expect(result.values['eta']?.value).toBeCloseTo(0.6, 4)
  })

  it('should report unsolved variables when insufficient data', () => {
    const inputs: Record<string, VariableState> = {
      p1: makeInput('p1', 100000, 'Pa'),
    }

    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.unsolved.length).toBeGreaterThan(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].type).toBe('insufficient_data')
  })

  it('should record solution steps with LaTeX', () => {
    // T1 = 300 K (kalt), T3 = 600 K (warm) → η = 0.5
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 300, 'K'),
      T3: makeInput('T3', 600, 'K'),
    }

    const result = solve(registry, carnotModule.variables, inputs)

    const etaStep = result.steps.find(s => s.targetVariable === 'eta')
    expect(etaStep).toBeDefined()
    expect(etaStep!.formulaName).toContain('Carnot')
    expect(etaStep!.originalLatex).toContain('\\eta')
    expect(etaStep!.rearrangedLatex).toContain('\\eta')
    expect(etaStep!.resultValue).toBeCloseTo(0.5, 4)
  })
})

describe('Carnot cycle: isothermal constraint propagation', () => {
  // Process sequence:  1 →[adiabat]→ 2 →[isotherm warm]→ 3 →[adiabat]→ 4 →[isotherm kalt]→ 1
  // T1=T4=T_kalt,  T2=T3=T_warm
  const registry = FormulaRegistry.fromModule(carnotModule)

  function makeInput(id: string, value: number, unit: string = ''): VariableState {
    return { value, unit, isUserInput: true, isComputed: false }
  }

  it('should propagate T2 = T3 (hot isotherm 2→3)', () => {
    // T3 = 500 K (warm) → T2 must equal T3
    const inputs: Record<string, VariableState> = {
      T3: makeInput('T3', 500, 'K'),
    }
    const result = solve(registry, carnotModule.variables, inputs)
    expect(result.values['T2']?.value).toBeCloseTo(500, 4)
    expect(result.values['T2']?.isComputed).toBe(true)
  })

  it('should propagate T4 = T1 (cold isotherm 4→1)', () => {
    // T1 = 250 K (kalt) → T4 must equal T1
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 250, 'K'),
    }
    const result = solve(registry, carnotModule.variables, inputs)
    expect(result.values['T4']?.value).toBeCloseTo(250, 4)
    expect(result.values['T4']?.isComputed).toBe(true)
  })

  it('should compute v2 and v3 from temperatures, pressures and Rs', () => {
    // Hot isotherm 2→3: v = Rs*T/p (ideal gas, specific volume)
    // T1=250K (kalt), T3=500K (warm)
    // T2 = T3 = 500K (isothermal constraint)
    // v2 = Rs*T2/p2 = 287*500/1000000 = 0.1435 m³/kg
    // v3 = Rs*T3/p3 = 287*500/200000  = 0.7175 m³/kg
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 250, 'K'),
      T3: makeInput('T3', 500, 'K'),
      p2: makeInput('p2', 1_000_000, 'Pa'),
      p3: makeInput('p3', 200_000, 'Pa'),
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
    }
    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['v2']?.value).toBeCloseTo(0.1435, 3)
    expect(result.values['v3']?.value).toBeCloseTo(0.7175, 3)
  })

  it('should compute v1 via adiabatic 1→2 relation', () => {
    // Adiabatic 1→2 (compression): T1*v1^(κ-1) = T2*v2^(κ-1)
    // v1 = v2 * (T2/T1)^(1/(κ-1)) = 0.1435 * (500/250)^2.5 = 0.1435 * 5.657 = 0.8119
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 250, 'K'),
      T3: makeInput('T3', 500, 'K'),
      p2: makeInput('p2', 1_000_000, 'Pa'),
      p3: makeInput('p3', 200_000, 'Pa'),
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
      kappa: makeInput('kappa', 1.4, ''),
    }
    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['v1']?.value).toBeCloseTo(0.8119, 3)
  })

  it('should solve the complete Carnot cycle from minimal inputs', () => {
    // Full cycle: T1(kalt), T3(warm), p2, p3, Rs, kappa → all state values + efficiency
    //
    // T1=250K (kalt), T3=500K (warm), p2=1MPa, p3=200kPa, Rs=287, κ=1.4
    //
    // Expected (pre-calculated):
    //   η   = 1 - T1/T3 = 0.5
    //   T2  = T3 = 500 K  (isotherm 2→3)
    //   T4  = T1 = 250 K  (isotherm 4→1)
    //   v2  = Rs·T2/p2 = 287·500/1000000 = 0.1435 m³/kg
    //   v3  = Rs·T3/p3 = 287·500/200000  = 0.7175 m³/kg
    //   v1  = v2·(T2/T1)^(1/(κ-1)) = 0.1435·2^2.5 ≈ 0.8119 m³/kg  [adiabat 1→2]
    //   v4  = v3·(T3/T4)^(1/(κ-1)) = 0.7175·2^2.5 ≈ 4.059 m³/kg   [adiabat 3→4]
    const inputs: Record<string, VariableState> = {
      T1: makeInput('T1', 250, 'K'),
      T3: makeInput('T3', 500, 'K'),
      p2: makeInput('p2', 1_000_000, 'Pa'),
      p3: makeInput('p3', 200_000, 'Pa'),
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
      kappa: makeInput('kappa', 1.4, ''),
    }
    const result = solve(registry, carnotModule.variables, inputs)
    const v = result.values

    expect(v['eta']?.value).toBeCloseTo(0.5, 4)
    expect(v['T2']?.value).toBeCloseTo(500, 2)
    expect(v['T4']?.value).toBeCloseTo(250, 2)
    expect(v['v2']?.value).toBeCloseTo(0.1435, 3)
    expect(v['v3']?.value).toBeCloseTo(0.7175, 3)
    expect(v['v1']?.value).toBeCloseTo(0.8119, 3)
    expect(v['v4']?.value).toBeCloseTo(4.059, 2)
  })

  it('should compute v2 from q_in (isothermal heat formula)', () => {
    // q_in = Rs * T3 * ln(v3/v2)  →  v2 = v3 * exp(-q_in / (Rs * T3))
    //
    // With T3=500K, v3=0.7175, Rs=287:
    //   q_in = 287 * 500 * ln(0.7175/0.1435) = 287*500*ln(5) = 287*500*1.6094 ≈ 231,142 J/kg
    //   Reverse: v2 = 0.7175 * exp(-231142 / (287*500)) = 0.7175 * exp(-1.6094) = 0.7175/5 = 0.1435
    const qIn = 287 * 500 * Math.log(5) // ≈ 231,142 J/kg

    const inputs: Record<string, VariableState> = {
      T3: makeInput('T3', 500, 'K'),
      v3: makeInput('v3', 0.7175, 'm^3/kg'),
      q_in: makeInput('q_in', qIn, 'J/kg'),
      Rs: makeInput('Rs', 287, 'J/(kg*K)'),
    }
    const result = solve(registry, carnotModule.variables, inputs)

    expect(result.values['v2']?.value).toBeCloseTo(0.1435, 3)
  })
})

describe('formatNumber', () => {
  it('should format integers', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('should format small decimals', () => {
    const result = formatNumber(3.14159)
    expect(result).toContain('3.14159')
  })

  it('should use scientific notation for large numbers', () => {
    const result = formatNumber(1500000)
    expect(result).toContain('\\times 10^')
  })

  it('should use scientific notation for small numbers', () => {
    const result = formatNumber(0.000123)
    expect(result).toContain('\\times 10^')
  })
})



describe('planned execution evidence isolation', () => {
  it('does not commit a rejected primary value or evidence row', () => {
    const variables: Variable[] = [
      { id: 'a', symbol: 'a', latex: 'a', name: 'a', defaultUnit: '', alternativeUnits: [] },
      { id: 'x', symbol: 'x', latex: 'x', name: 'x', defaultUnit: '', alternativeUnits: [] },
    ]
    const formula: Formula = {
      id: 'x_from_a', name: 'x from a', latex: 'x = a', variables: ['x', 'a'],
      solveFor: { x: 'a' }, latexSteps: { x: { rearranged: 'x = a', explanation: 'test' } },
    }
    const registry = new FormulaRegistry()
    registry.register(formula)
    const result = solve(registry, variables, { a: { value: 2, unit: '', isUserInput: true, isComputed: false } }, [], {
      plannedExecution: { postValidate: targetId => targetId === 'x'
        ? [{ type: 'contradiction', variableId: 'x', message: 'forced post-validation failure' }]
        : [] },
    })
    expect(result.values.x.value).toBeNull()
    expect(result.steps.some(step => step.targetVariable === 'x')).toBe(false)
    expect(result.errors).toMatchObject([{ type: 'contradiction', variableId: 'x' }])
  })
})

describe('presentation failure isolation', () => {
  it('keeps accepted values, errors, raw order, and later calculations unchanged when the adapter throws', () => {
    const variables: Variable[] = [
      { id: 'a', symbol: 'a', latex: 'a', name: 'a', defaultUnit: '', alternativeUnits: [] },
      { id: 'x', symbol: 'x', latex: 'x', name: 'x', defaultUnit: '', alternativeUnits: [] },
      { id: 'y', symbol: 'y', latex: 'y', name: 'y', defaultUnit: '', alternativeUnits: [] },
    ]
    const xFormula = (withFault: boolean): Formula => ({
      id: 'x_from_a', name: 'x', latex: 'x = a', variables: ['x', 'a'], solveFor: { x: 'a' },
      latexSteps: { x: withFault
        ? { rearranged: 'x = a', explanation: 'x', derivation: { optedIn: true, rearrangement: 'show', substitution: { mode: 'explicit-override', buildLatex: () => { throw new Error('forced presentation fault') } }, narrative: { phase: 'performance', rank: 1 } } }
        : { rearranged: 'x = a', explanation: 'x' } },
    })
    const yFormula: Formula = { id: 'y_from_x', name: 'y', latex: 'y = x + 1', variables: ['y', 'x'], solveFor: { y: 'x + 1' }, latexSteps: { y: { rearranged: 'y = x + 1', explanation: 'y' } } }
    const run = (withFault: boolean) => {
      const registry = new FormulaRegistry()
      registry.registerAll([xFormula(withFault), yFormula])
      return solve(registry, variables, { a: { value: 2, unit: '', isUserInput: true, isComputed: false } })
    }
    const baseline = run(false)
    const faulted = run(true)
    expect(faulted.values).toEqual(baseline.values)
    expect(faulted.errors).toEqual(baseline.errors)
    expect(faulted.unsolved).toEqual(baseline.unsolved)
    expect(faulted.steps.map(step => step.targetVariable)).toEqual(baseline.steps.map(step => step.targetVariable))
    expect(faulted.steps[0].derivationState?.mode).toBe('unavailable')
    expect(faulted.values.y.value).toBe(3)
  })
})
